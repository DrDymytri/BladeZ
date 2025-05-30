require("dotenv").config();

const FRONTEND_URL = process.env.FRONTEND_URL;
const BACKEND_URL = process.env.BACKEND_URL;

console.log("Loaded environment variables:", process.env); // Debug log to verify all variables

if (!process.env.STRIPE_SECRET_KEY) {
    console.error("STRIPE_SECRET_KEY is not defined. Check your .env file.");
    throw new Error("STRIPE_SECRET_KEY is not defined in the .env file.");
}

const express = require("express");
const cors = require("cors");
const sql = require("mssql");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt"); // Replace bcryptjs with bcrypt
const path = require("path");
const multer = require("multer");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const nodemailer = require("nodemailer");
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

const stripe = require("stripe")(stripeSecretKey);
const jwt = require("jsonwebtoken");
const paypal = require("@paypal/checkout-server-sdk");

const SECRET_KEY = process.env.JWT_SECRET;
const PORT = process.env.PORT || 5000;

// Initialize PayPal client
const paypalClient = new paypal.core.PayPalHttpClient(
    new paypal.core.SandboxEnvironment(
        process.env.PAYPAL_CLIENT_ID,
        process.env.PAYPAL_CLIENT_SECRET
    )
);

const app = express();

// Use the Render-provided external URL or fallback to localhost
const BASE_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;

// Middleware
const allowedOrigins = ["http://localhost:5000", "https://pointfxbladez.com"];
app.use(cors({
  origin: function (origin, callback) {
    if (allowedOrigins.includes(origin) || !origin) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  }
}));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(__dirname)); // Serve static files from the root directory
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Ensure session_id for guest users
app.use((req, res, next) => {
    if (!req.cookies.session_id) {
        res.cookie("session_id", uuidv4(), { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
    }
    next();
});

// Middleware to authenticate user using JWT
function authenticateToken(req, res, next) {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Access denied. No token provided." });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ error: "Invalid or expired token." });
        req.user = user;
        next();
    });
}

// Database configuration
const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT) || 1433,
    options: {
        encrypt: process.env.DB_ENCRYPT === "true",
        trustServerCertificate: true,
    },
};

// Global connection pool
let pool;

async function getConnection() {
    try {
        if (!pool || !pool.connected) {
            pool = await sql.connect(dbConfig);
            console.log("✅ Database connection established."); // Keep this log for monitoring
        }
        return pool;
    } catch (error) {
        console.error("❌ Error establishing database connection:", error.message); // Keep this log for debugging
        throw error;
    }
}

// Ensure upload folders exist
["uploads", "uploads/images", "uploads/videos"].forEach((folder) => {
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
});

// Multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadFolder = file.mimetype.startsWith("image/") ? "uploads/images" : "uploads/videos";
        cb(null, uploadFolder);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    },
});
const upload = multer({ storage });

// Routes
app.get("/api/categories", async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request().query(`
            SELECT CategoryID AS id, Name AS name 
            FROM Categories
            ORDER BY Name ASC
        `);
        res.json(result.recordset);
    } catch (error) {
        console.error("Error fetching categories:", error.message);
        res.status(500).json({ error: "Failed to fetch categories." });
    }
});

app.post("/api/login", async (req, res) => {
    const { email, password } = req.body;
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input("email", sql.NVarChar, email)
            .query("SELECT id, email, password FROM Users WHERE email = @Email");

        const user = result.recordset[0];
        if (!user) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        console.log("Generating token for user ID:", user.id); // Log user ID
        const token = jwt.sign({ id: user.id, email: user.email }, SECRET_KEY, { expiresIn: "1h" });
        res.json({ token });
    } catch (error) {
        console.error("Error during user login:", error.message);
        res.status(500).json({ error: "Failed to login" });
    }
});

app.post("/api/signup", async (req, res) => {
    const { firstName, lastName, email, password, phone, address } = req.body;

    if (!firstName || !lastName || !email || !password || !phone || !address) {
        return res.status(400).json({ error: "All fields are required." });
    }

    try {
        const pool = await getConnection();

        // Check if the email is already registered
        const existingUser = await pool.request()
            .input("email", sql.NVarChar, email)
            .query("SELECT id FROM Users WHERE email = @Email");

        if (existingUser.recordset.length > 0) {
            return res.status(409).json({ error: "Email is already registered." });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert the new user into the database
        const result = await pool.request()
            .input("firstName", sql.NVarChar, firstName)
            .input("lastName", sql.NVarChar, lastName)
            .input("email", sql.NVarChar, email)
            .input("password", sql.NVarChar, hashedPassword)
            .input("phone", sql.NVarChar, phone)
            .input("address", sql.NVarChar, address)
            .query(`
                INSERT INTO Users (first_name, last_name, email, password, phone, address)
                OUTPUT INSERTED.id, INSERTED.first_name, INSERTED.last_name, INSERTED.email
                VALUES (@firstName, @lastName, @Email, @Password, @Phone, @Address)
            `);

        const newUser = result.recordset[0];
        res.status(201).json({ message: "User registered successfully.", user: newUser });
    } catch (error) {
        console.error("Error during user registration:", error.message);
        res.status(500).json({ error: "Failed to register user." });
    }
});

app.get("/api/subcategories", async (req, res) => {
    const { categoryId } = req.query;
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input("categoryId", sql.Int, categoryId || null)
            .query(`
                SELECT SubCategoryID AS id, SubCategoryName AS name, CategoryID AS categoryId 
                FROM SubCategories 
                WHERE @categoryId IS NULL OR CategoryID = @categoryId
                ORDER BY SubCategoryName ASC
            `);
        res.json(result.recordset);
    } catch (error) {
        console.error("Error fetching subcategories:", error.message);
        res.status(500).send("Failed to fetch subcategories.");
    }
});

app.post("/api/subcategories", async (req, res) => {
    const { name, categoryId } = req.body;
    if (!name || !categoryId) {
        return res.status(400).json({ error: "Subcategory name and category ID are required." });
    }
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input("name", sql.NVarChar, name)
            .input("categoryId", sql.Int, categoryId)
            .query(`
                INSERT INTO SubCategories (SubCategoryName, CategoryID)
                OUTPUT INSERTED.SubCategoryID AS id, INSERTED.SubCategoryName AS name, INSERTED.CategoryID AS categoryId
                VALUES (@name, @categoryId)
            `);
        res.status(201).json(result.recordset[0]);
    } catch (error) {
        console.error("Error creating subcategory:", error.message);
        res.status(500).json({ error: "Failed to create subcategory." });
    }
});

app.put("/api/subcategories/:id", async (req, res) => {
    const { id } = req.params;
    const { name, categoryId } = req.body;

    if (!name || !categoryId) {
        return res.status(400).json({ error: "Subcategory name and category ID are required." });
    }

    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input("id", sql.Int, id)
            .input("name", sql.NVarChar, name)
            .input("categoryId", sql.Int, categoryId)
            .query(`
                UPDATE SubCategories
                SET SubCategoryName = @name, CategoryID = @categoryId
                WHERE SubCategoryID = @id
            `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: "Subcategory not found." });
        }

        res.json({ message: "Subcategory updated successfully." });
    } catch (error) {
        console.error("Error updating subcategory:", error.message);
        res.status(500).json({ error: "Failed to update subcategory." });
    }
});

app.get("/api/descriptors", async (req, res) => {
    const { subCategoryId } = req.query;
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input("subCategoryId", sql.Int, subCategoryId || null)
            .query(`
                SELECT DescriptorID AS id, DescriptorName AS name, SubCategoryID AS subCategoryId 
                FROM Descriptors 
                WHERE @subCategoryId IS NULL OR SubCategoryID = @subCategoryId
                ORDER BY DescriptorName ASC
            `);
        res.json(result.recordset);
    } catch (error) {
        console.error("Error fetching descriptors:", error.message);
        res.status(500).send("Failed to fetch descriptors.");
    }
});

app.post("/api/descriptors", async (req, res) => {
    const { name, subCategoryId } = req.body;

    if (!name || !subCategoryId) {
        return res.status(400).json({ error: "Descriptor name and subcategory ID are required." });
    }

    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input("name", sql.NVarChar, name)
            .input("subCategoryId", sql.Int, subCategoryId)
            .query(`
                INSERT INTO Descriptors (DescriptorName, SubCategoryID)
                OUTPUT INSERTED.DescriptorID AS id, INSERTED.DescriptorName AS name, INSERTED.SubCategoryID AS subCategoryId
                VALUES (@name, @subCategoryId)
            `);

        res.status(201).json(result.recordset[0]);
    } catch (error) {
        console.error("Error creating descriptor:", error.message);
        res.status(500).json({ error: "Failed to create descriptor." });
    }
});

app.put("/api/descriptors/:id", async (req, res) => {
    const { id } = req.params;
    const { name, subCategoryId } = req.body;

    // Log the incoming request body for debugging
    console.log("PUT /api/descriptors/:id - Request body:", req.body);

    if (!name || !subCategoryId) {
        return res.status(400).json({ error: "Descriptor name and subcategory ID are required." });
    }

    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input("id", sql.Int, id)
            .input("name", sql.NVarChar, name)
            .input("subCategoryId", sql.Int, subCategoryId)
            .query(`
                UPDATE Descriptors
                SET DescriptorName = @name, SubCategoryID = @subCategoryId
                WHERE DescriptorID = @id
            `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: "Descriptor not found." });
        }

        res.json({ message: "Descriptor updated successfully." });
    } catch (error) {
        console.error("Error updating descriptor:", error.message);
        res.status(500).json({ error: "Failed to update descriptor." });
    }
});

app.delete("/api/descriptors/:id", async (req, res) => {
    const { id } = req.params;

    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input("id", sql.Int, id)
            .query(`
                DELETE FROM Descriptors
                WHERE DescriptorID = @id
            `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: "Descriptor not found." });
        }

        res.json({ message: "Descriptor deleted successfully." });
    } catch (error) {
        console.error("Error deleting descriptor:", error.message);
        res.status(500).json({ error: "Failed to delete descriptor." });
    }
});

app.delete("/api/subcategories/:id", async (req, res) => {
    const { id } = req.params;

    try {
        const pool = await getConnection();

        // Delete associated descriptors first
        await pool.request()
            .input("subCategoryId", sql.Int, id)
            .query(`
                DELETE FROM Descriptors
                WHERE SubCategoryID = @subCategoryId
            `);

        // Delete the subcategory
        const result = await pool.request()
            .input("id", sql.Int, id)
            .query(`
                DELETE FROM SubCategories
                WHERE SubCategoryID = @id
            `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: "Subcategory not found." });
        }

        res.json({ message: "Subcategory and its descriptors deleted successfully." });
    } catch (error) {
        console.error("Error deleting subcategory:", error.message);
        res.status(500).json({ error: "Failed to delete subcategory." });
    }
});

app.delete("/api/categories/:id", async (req, res) => {
    const { id } = req.params;

    try {
        const pool = await getConnection();

        // Delete associated subcategories and their descriptors first
        const subcategories = await pool.request()
            .input("categoryId", sql.Int, id)
            .query(`
                SELECT SubCategoryID
                FROM SubCategories
                WHERE CategoryID = @categoryId
            `);

        for (const subcategory of subcategories.recordset) {
            await pool.request()
                .input("subCategoryId", sql.Int, subcategory.SubCategoryID)
                .query(`
                    DELETE FROM Descriptors
                    WHERE SubCategoryID = @subCategoryId
                `);
        }

        await pool.request()
            .input("categoryId", sql.Int, id)
            .query(`
                DELETE FROM SubCategories
                WHERE CategoryID = @categoryId
            `);

        // Delete the category
        const result = await pool.request()
            .input("id", sql.Int, id)
            .query(`
                DELETE FROM Categories
                WHERE CategoryID = @id
            `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: "Category not found." });
        }

        res.json({ message: "Category, its subcategories, and their descriptors deleted successfully." });
    } catch (error) {
        console.error("Error deleting category:", error.message);
        res.status(500).json({ error: "Failed to delete category." });
    }
});

app.get("/api/products", async (req, res) => {
    const { categoryId, subCategoryId, descriptorId, page = 1, limit = 30 } = req.query;

    try {
        const pool = await getConnection();
        let query = `
            SELECT id, name, description, price, stock_quantity, image_url, is_showcase
            FROM Products
            WHERE 1=1
        `;
        const request = pool.request();

        if (categoryId) {
            query += " AND category_id = @categoryId";
            request.input("categoryId", sql.Int, parseInt(categoryId, 10));
        }
        if (subCategoryId) {
            query += " AND sub_category_id = @subCategoryId";
            request.input("subCategoryId", sql.Int, parseInt(subCategoryId, 10));
        }
        if (descriptorId) {
            query += " AND tag_id = @descriptorId";
            request.input("descriptorId", sql.Int, parseInt(descriptorId, 10));
        }

        // Fetch total count for pagination
        let totalQuery = `
            SELECT COUNT(*) AS total
            FROM Products
            WHERE 1=1
        `;
        if (categoryId) {
            totalQuery += " AND category_id = @categoryId";
        }
        if (subCategoryId) {
            totalQuery += " AND sub_category_id = @subCategoryId";
        }
        if (descriptorId) {
            totalQuery += " AND tag_id = @descriptorId";
        }

        const totalResult = await request.query(totalQuery);
        const total = totalResult.recordset[0].total;

        // Ensure limit and offset are integers
        const parsedLimit = parseInt(limit, 10);
        const parsedOffset = (parseInt(page, 10) - 1) * parsedLimit;

        if (isNaN(parsedLimit) || isNaN(parsedOffset)) {
            return res.status(400).json({ error: "Invalid pagination parameters." });
        }

        query += `
            ORDER BY name ASC
            OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
        `;
        request.input("offset", sql.Int, parsedOffset);
        request.input("limit", sql.Int, parsedLimit);

        const result = await request.query(query);

        const totalPages = Math.ceil(total / parsedLimit);

        res.json({ products: result.recordset, total, totalPages });
    } catch (error) {
        console.error("Error fetching products:", error.message);
        res.status(500).json({ error: "Failed to fetch products." });
    }
});

app.get("/api/showcase-products", async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .query(`
                SELECT id, name, description, price, image_url, stock_quantity 
                FROM Products 
                WHERE is_showcase = 1
            `);
        res.json(result.recordset);
    } catch (error) {
        console.error("Error fetching showcase products:", error.message);
        res.status(500).json({ error: "Failed to fetch showcase products." });
    }
});

app.get("/api/paypal-client-id", (req, res) => {
    try {
        const clientId = process.env.PAYPAL_CLIENT_ID;
        if (!clientId) {
            return res.status(500).json({ error: "PayPal client ID not configured." });
        }
        res.json({ clientId });
    } catch (error) {
        console.error("Error fetching PayPal client ID:", error.message);
        res.status(500).json({ error: "Failed to fetch PayPal client ID." });
    }
});

app.post("/api/create-payment-intent", async (req, res) => {
    try {
        const { amount, cart } = req.body;
        if (!amount || !cart || cart.length === 0) {
            return res.status(400).json({ error: "Invalid request. Amount and cart details are required." });
        }

        // Create a payment intent with Stripe
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // Convert to cents
            currency: "usd",
            payment_method_types: ["card"],
        });

        res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
        console.error("Error creating payment intent:", error.message);
        res.status(500).json({ error: "Failed to create payment intent." });
    }
});

app.post("/api/orders", authenticateToken, async (req, res) => {
    try {
        const { items, total } = req.body;
        if (!items || items.length === 0 || !total) {
            return res.status(400).json({ error: "Invalid request. Items and total are required." });
        }

        const pool = await getConnection();

        // Insert order into Orders table
        const orderResult = await pool.request()
            .input("userId", sql.Int, req.user.id) // Ensure req.user.id is populated by authenticateToken
            .input("total", sql.Decimal(10, 2), total)
            .query(`
                INSERT INTO orders (user_id, total_amount, created_at)
                OUTPUT INSERTED.id -- Use the correct column name for the inserted order ID
                VALUES (@userId, @total, GETDATE())
            `);
        const orderId = orderResult.recordset[0].id; // Use the correct column name

        // Insert order items into the order_items table and update stock
        for (const item of items) {
            // Insert order item
            await pool.request()
                .input("orderId", sql.Int, orderId)
                .input("productId", sql.Int, item.id)
                .input("quantity", sql.Int, item.quantity)
                .input("price", sql.Decimal(10, 2), item.price)
                .query(`
                    INSERT INTO order_items (order_id, product_id, quantity, price)
                    VALUES (@orderId, @productId, @quantity, @price)
                `);

            // Reduce stock (allow negative values)
            await pool.request()
                .input("productId", sql.Int, item.id)
                .input("quantity", sql.Int, item.quantity)
                .query(`
                    UPDATE Products
                    SET stock_quantity = stock_quantity - @quantity
                    WHERE id = @productId
                `);
        }

        res.json({ message: "Order placed successfully", orderId });
    } catch (error) {
        console.error("Error placing order:", error.message);
        console.error("Stack trace:", error.stack); // Log stack trace for debugging
        res.status(500).json({ error: "Failed to place order." });
    }
});

app.get("/api/orders", authenticateToken, async (req, res) => {
    try {
        const pool = await getConnection();

        // Log the user ID for debugging
        console.log("Fetching orders for user ID:", req.user.id);

        // Fetch orders for the logged-in user
        const ordersResult = await pool.request()
            .input("userId", sql.Int, req.user.id)
            .query(`
                SELECT o.id AS orderId, o.total_amount AS total, o.status, o.shipping_status AS shippingStatus,
                       o.tracking_number AS trackingNumber, o.created_at AS orderDate,
                       oi.product_id AS productId, oi.quantity, oi.price
                FROM orders o
                INNER JOIN order_items oi ON o.id = oi.order_id
                WHERE o.user_id = @userId
                ORDER BY o.created_at DESC
            `);
        const orders = ordersResult.recordset;

        // Log the fetched orders for debugging
        console.log("Fetched orders:", orders);

        if (orders.length === 0) {
            console.log("No orders found for user ID:", req.user.id);
            return res.json({ message: "No orders found.", orders: [] });
        }

        res.json({ orders });
    } catch (error) {
        console.error("Error fetching orders:", error.message);
        console.error("Stack trace:", error.stack); // Log stack trace for debugging
        res.status(500).json({ error: "Failed to fetch orders." });
    }
});

app.get("/api/events", async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request().query(`
      SELECT id, title, description, event_start_date AS startDate, event_end_date AS endDate, location, event_website
      FROM Events
      ORDER BY event_start_date ASC -- Changed to ascending order
    `);
    res.json(result.recordset);
  } catch (error) {
    console.error("Error fetching events:", error.message);
    res.status(500).json({ error: "Failed to load events. Please try again later." });
  }
});

app.put("/api/events/:id", async (req, res) => {
  const { id } = req.params;
  const { title, description, event_start_date, event_end_date, location, website } = req.body;

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input("id", sql.Int, id)
      .input("title", sql.NVarChar, title)
      .input("description", sql.NVarChar, description)
      .input("event_start_date", sql.DateTime, event_start_date)
      .input("event_end_date", sql.DateTime, event_end_date)
      .input("location", sql.NVarChar, location)
      .input("website", sql.NVarChar, website)
      .query(`
        UPDATE Events
        SET title = @title,
            description = @description,
            event_start_date = @event_start_date,
            event_end_date = @event_end_date,
            location = @location,
            event_website = @website
        WHERE id = @id
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: "Event not found" });
    }

    res.json({ message: "Event updated successfully" });
  } catch (error) {
    console.error("Error updating event:", error.message);
    res.status(500).json({ error: "Failed to update event" });
  }
});

app.delete("/api/events/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input("id", sql.Int, id)
      .query(`
        DELETE FROM Events
        WHERE id = @id
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: "Event not found" });
    }

    res.json({ message: "Event deleted successfully" });
  } catch (error) {
    console.error("Error deleting event:", error.message);
    res.status(500).json({ error: "Failed to delete event" });
  }
});

app.post("/api/events", async (req, res) => {
  const { title, description, event_start_date, event_end_date, location, website } = req.body;

  if (!title || !description || !event_start_date || !event_end_date || !location || !website) {
    return res.status(400).json({ error: "All fields are required." });
  }

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input("title", sql.NVarChar, title)
      .input("description", sql.NVarChar, description)
      .input("event_start_date", sql.DateTime, event_start_date)
      .input("event_end_date", sql.DateTime, event_end_date)
      .input("location", sql.NVarChar, location)
      .input("website", sql.NVarChar, website)
      .query(`
        INSERT INTO Events (title, description, event_start_date, event_end_date, location, event_website)
        OUTPUT INSERTED.id, INSERTED.title, INSERTED.description, INSERTED.event_start_date AS startDate, 
               INSERTED.event_end_date AS endDate, INSERTED.location, INSERTED.event_website AS website
        VALUES (@title, @description, @event_start_date, @event_end_date, @location, @website)
      `);

    res.status(201).json(result.recordset[0]);
  } catch (error) {
    console.error("Error creating event:", error.message);
    res.status(500).json({ error: "Failed to create event." });
  }
});

app.get("/api/images", async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input("mediaType", sql.NVarChar, "image") // Filter by MediaType = 'image'
            .query(`
                SELECT MediaID AS id, MediaTitle AS title, MediaPath AS path, UploadedAt AS uploadedAt, UploadedBy AS uploadedBy, ProductID AS productId
                FROM Media
                WHERE MediaType = @mediaType
                ORDER BY UploadedAt DESC
            `);
        res.json(result.recordset);
    } catch (error) {
        console.error("Error fetching images:", error.message);
        res.status(500).json({ error: "Failed to load images. Please try again later." });
    }
});

app.get("/api/videos", async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .query(`
                SELECT MediaID AS id, MediaType AS type, MediaTitle AS title, MediaPath AS path, UploadedAt AS uploadedAt, UploadedBy AS uploadedBy, ProductID AS productId
                FROM Media
                WHERE LOWER(MediaType) IN ('video', 'youtube') -- Case-insensitive comparison for both types
                  AND MediaPath IS NOT NULL -- Ensure MediaPath is not null
                  AND LEN(MediaPath) > 0 -- Ensure MediaPath is not empty
                ORDER BY UploadedAt DESC
            `);
        if (result.recordset.length === 0) {
            return res.json([]);
        }

        res.json(result.recordset);
    } catch (error) {
        console.error("Error fetching videos:", error.message);
        res.status(500).json({ error: "Failed to load videos. Please try again later." });
    }
});

app.get("/api/cart-products", async (req, res) => {
    const { ids } = req.query;

    if (!ids) {
        return res.status(400).json({ error: "Product IDs are required." });
    }

    const productIds = ids.split(",").map((id) => parseInt(id, 10));

    try {
        const pool = await getConnection();
        const request = pool.request();

        // Dynamically construct the WHERE clause with parameterized inputs
        const conditions = productIds.map((id, index) => {
            const paramName = `id${index}`;
            request.input(paramName, sql.Int, id);
            return `@${paramName}`;
        });

        const query = `
            SELECT id, name, price, image_url
            FROM Products
            WHERE id IN (${conditions.join(",")})
        `;

        const result = await request.query(query);

        res.json(result.recordset);
    } catch (error) {
        console.error("Error fetching cart products:", error.message);
        res.status(500).json({ error: "Failed to fetch cart products." });
    }
});

app.get("/api/low-stock-products", async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request().query(`
            SELECT id, name, stock_quantity, restock_threshold, price
            FROM Products
            WHERE stock_quantity < 2 -- Adjust the threshold as needed
            ORDER BY stock_quantity ASC
        `);
        res.json(result.recordset);
    } catch (error) {
        console.error("Error fetching low-stock products:", error.message);
        res.status(500).json({ error: "Failed to fetch low-stock products." });
    }
});

app.get("/api/products/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input("id", sql.Int, id)
            .query(`
                SELECT id, name, description, price, stock_quantity, image_url, category_id, sub_category_id, tag_id, restock_threshold, manufacturer_product_number, is_showcase
                FROM Products
                WHERE id = @id
            `); // Added is_showcase to the SELECT statement
        const product = result.recordset[0];
        console.log("Fetched product:", product); // Debug log to verify the product data
        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }

        res.json(product);
    } catch (error) {
        console.error("Error fetching product details:", error.message);
        res.status(500).json({ error: "Failed to fetch product details." });
    }
});

app.post("/api/products", async (req, res) => {
    const { name, description, price, stock_quantity, category_id, sub_category_id, tag_id, image_url, is_showcase, manufacturer_product_number, restock_threshold } = req.body;

    if (!name || !price || !stock_quantity || !category_id) {
        return res.status(400).json({ error: "Name, price, stock quantity, and category ID are required." });
    }

    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input("name", sql.NVarChar, name)
            .input("description", sql.NVarChar, description || null)
            .input("price", sql.Decimal(10, 2), price)
            .input("stock_quantity", sql.Int, stock_quantity)
            .input("category_id", sql.Int, category_id)
            .input("sub_category_id", sql.Int, sub_category_id || null)
            .input("tag_id", sql.Int, tag_id || null)
            .input("image_url", sql.NVarChar, image_url || null)
            .input("is_showcase", sql.Bit, is_showcase || false)
            .input("manufacturer_product_number", sql.NVarChar, manufacturer_product_number || null)
            .input("restock_threshold", sql.Int, restock_threshold || 0)
            .query(`
                INSERT INTO Products (name, description, price, stock_quantity, category_id, sub_category_id, tag_id, image_url, is_showcase, manufacturer_product_number, restock_threshold, created_at, updated_at)
                OUTPUT INSERTED.id, INSERTED.name, INSERTED.description, INSERTED.price, INSERTED.stock_quantity, INSERTED.category_id, INSERTED.sub_category_id, INSERTED.tag_id, INSERTED.image_url, INSERTED.is_showcase, INSERTED.manufacturer_product_number, INSERTED.restock_threshold, INSERTED.created_at, INSERTED.updated_at
                VALUES (@name, @description, @price, @stock_quantity, @category_id, @sub_category_id, @tag_id, @image_url, @is_showcase, @manufacturer_product_number, @restock_threshold, GETDATE(), GETDATE())
            `);

        res.status(201).json(result.recordset[0]);
    } catch (error) {
        console.error("Error creating product:", error.message);
        res.status(500).json({ error: "Failed to create product." });
    }
});

app.put("/api/products/:id", async (req, res) => {
    const { id } = req.params;
    const { name, description, price, stock_quantity, category_id, sub_category_id, tag_id, image_url, is_showcase, manufacturer_product_number, restock_threshold } = req.body;

    if (!name || !price || !stock_quantity || !category_id || !manufacturer_product_number) {
        return res.status(400).json({ error: "Name, price, stock quantity, category ID, and manufacturer product number are required." });
    }

    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input("id", sql.Int, id)
            .input("name", sql.NVarChar, name)
            .input("description", sql.NVarChar, description || null)
            .input("price", sql.Decimal(10, 2), price)
            .input("stock_quantity", sql.Int, stock_quantity)
            .input("category_id", sql.Int, category_id)
            .input("sub_category_id", sql.Int, sub_category_id || null)
            .input("tag_id", sql.Int, tag_id || null)
            .input("image_url", sql.NVarChar, image_url || null)
            .input("is_showcase", sql.Bit, is_showcase || false)
            .input("manufacturer_product_number", sql.NVarChar, manufacturer_product_number) // Ensure this is not null
            .input("restock_threshold", sql.Int, restock_threshold || 0)
            .query(`
                UPDATE Products
                SET name = @name,
                    description = @description,
                    price = @price,
                    stock_quantity = @stock_quantity,
                    category_id = @category_id,
                    sub_category_id = @sub_category_id,
                    tag_id = @tag_id,
                    image_url = @image_url,
                    is_showcase = @is_showcase,
                    manufacturer_product_number = @manufacturer_product_number,
                    restock_threshold = @restock_threshold,
                    updated_at = GETDATE()
                WHERE id = @id
            `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: "Product not found." });
        }

        res.json({ message: "Product updated successfully" });
    } catch (error) {
        console.error("Error updating product:", error.message);
        res.status(500).json({ error: "Failed to update product." });
    }
});

// GET /api/media - Fetch media data
app.get("/api/media", async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request().query(`
            SELECT MediaID AS id, MediaType AS MediaType, MediaTitle AS MediaTitle, MediaPath AS MediaPath
            FROM Media
            ORDER BY UploadedAt DESC
        `);

        if (result.recordset.length === 0) {
            return res.json([]);
        }

        res.json(result.recordset);
    } catch (error) {
        console.error("Error fetching media:", error.message);
        res.status(500).json({ error: "Failed to load media. Please try again later." });
    }
});

// POST /api/media - Upload a new media item
app.post("/api/media", upload.single("mediaFile"), async (req, res) => {
    const { MediaTitle, MediaType, UploadedBy, MediaPath } = req.body;
    const file = req.file;

    try {
        const pool = await getConnection();

        // Determine the media path
        let mediaPath = MediaPath; // For YouTube or other external links
        if (file) {
            mediaPath = `/uploads/${file.mimetype.startsWith("image/") ? "images" : "videos"}/${file.filename}`;
        }

        // Insert the media item into the database
        const result = await pool.request()
            .input("MediaTitle", sql.NVarChar, MediaTitle)
            .input("MediaType", sql.NVarChar, MediaType)
            .input("UploadedBy", sql.NVarChar, UploadedBy)
            .input("MediaPath", sql.NVarChar, mediaPath)
            .query(`
                INSERT INTO Media (MediaTitle, MediaType, UploadedBy, MediaPath, UploadedAt)
                OUTPUT INSERTED.MediaID AS id, INSERTED.MediaTitle AS title, INSERTED.MediaType AS type, INSERTED.MediaPath AS path
                VALUES (@MediaTitle, @MediaType, @UploadedBy, @MediaPath, GETDATE())
            `);

        res.status(201).json(result.recordset[0]);
    } catch (error) {
        console.error("Error uploading media:", error.message);
        res.status(500).json({ error: "Failed to upload media." });
    }
});

// DELETE /api/media/:id - Delete a media item by ID
app.delete("/api/media/:id", async (req, res) => {
    const { id } = req.params;

    try {
        const pool = await getConnection();

        // Check if the media item exists
        const checkResult = await pool.request()
            .input("id", sql.Int, id)
            .query("SELECT MediaPath FROM Media WHERE MediaID = @id");

        const mediaItem = checkResult.recordset[0];
        if (!mediaItem) {
            return res.status(404).json({ error: "Media item not found." });
        }

        // Delete the media file from the filesystem
        const mediaPath = path.join(__dirname, mediaItem.MediaPath);
        if (fs.existsSync(mediaPath)) {
            fs.unlinkSync(mediaPath);
        }

        // Delete the media item from the database
        await pool.request()
            .input("id", sql.Int, id)
            .query("DELETE FROM Media WHERE MediaID = @id");

        res.json({ message: "Media item deleted successfully." });
    } catch (error) {
        console.error("Error deleting media item:", error.message);
        res.status(500).json({ error: "Failed to delete media item." });
    }
});

app.get("/api/admin/orders", async (req, res) => {
  const { status } = req.query; // Get the status filter from the query parameters

  try {
    const pool = await getConnection();

    let query = `
      SELECT o.id AS id, 
             o.total_amount AS total_amount, 
             o.status AS status,
             o.tracking_number AS tracking_number,
             o.created_at AS created_at, 
             o.shipped_date AS shipped_date, -- Ensure shipped_date is included
             o.closed_date AS closed_date,
             o.received_confirmation_number AS received_confirmation_number,
             o.confirmation_date_time AS confirmation_date_time,
             u.first_name + ' ' + u.last_name AS user_name
      FROM orders o
      LEFT JOIN Users u ON o.user_id = u.id
    `;

    if (status && status !== "All") {
      query += ` WHERE o.status = @status`; // Add a WHERE clause if a specific status is provided
    } else if (status === "All") {
      query += ` WHERE o.status != 'Closed'`; // Exclude "Closed" orders when "All" is selected
    }

    query += ` ORDER BY o.created_at DESC`;

    const request = pool.request();
    if (status && status !== "All") {
      request.input("status", sql.NVarChar, status);
    }

    const result = await request.query(query);

    res.json(result.recordset.map(order => ({
      ...order,
      shipped_date: order.shipped_date ? order.shipped_date.toISOString() : null // Convert to ISO string for full date and time
    })));
  } catch (error) {
    console.error("Error fetching admin orders:", error.message);
    res.status(500).json({ error: "Failed to fetch orders." });
  }
});

app.put("/api/admin/orders/:id/status", async (req, res) => {
    const { id } = req.params;
    const { status, trackingNumber, receivedConfirmationNumber } = req.body;

    if (!status) {
        return res.status(400).json({ error: "Order status is required." });
    }

    try {
        const pool = await getConnection();

        // Fetch the existing order to check the current status
        const existingOrder = await pool.request()
            .input("id", sql.Int, id)
            .query(`
                SELECT status, tracking_number, shipped_date
                FROM orders
                WHERE id = @id
            `);

        if (existingOrder.recordset.length === 0) {
            return res.status(404).json({ error: "Order not found." });
        }

        const existingStatus = existingOrder.recordset[0].status;
        const existingTrackingNumber = existingOrder.recordset[0].tracking_number;

        // Automatically set the shipped_date if transitioning from "Boxed" to "Shipped"
        let shippedDate = null;
        if (existingStatus === "Boxed" && status === "Shipped") {
            shippedDate = new Date();
            console.log(`Setting shipped_date to ${shippedDate} for order ID: ${id}`);
        }

        // Prepare additional fields for "Closed" or "Received" statuses
        const closedDate = status === "Closed" ? new Date() : null;
        const confirmationDateTime = receivedConfirmationNumber ? new Date() : null;

        const result = await pool.request()
            .input("id", sql.Int, id)
            .input("status", sql.NVarChar, status)
            .input("trackingNumber", sql.NVarChar, trackingNumber || existingTrackingNumber)
            .input("shippedDate", sql.DateTime, shippedDate)
            .input("closedDate", sql.Date, closedDate)
            .input("receivedConfirmationNumber", sql.NVarChar, receivedConfirmationNumber || null)
            .input("confirmationDateTime", sql.DateTime, confirmationDateTime)
            .query(`
                UPDATE orders
                SET status = @status,
                    tracking_number = @trackingNumber,
                    shipped_date = COALESCE(@shippedDate, shipped_date), -- Update shipped_date
                    closed_date = @closedDate,
                    received_confirmation_number = @receivedConfirmationNumber,
                    confirmation_date_time = @confirmationDateTime
                WHERE id = @id
            `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: "Order not found." });
        }

        res.json({ message: "Order status updated successfully." });
    } catch (error) {
        console.error("Error updating order status:", error.message);
        res.status(500).json({ error: "Failed to update order status." });
    }
});

app.put("/api/admin/orders/:id/tracking", async (req, res) => {
  const { id } = req.params;
  const { trackingNumber } = req.body;

  if (!trackingNumber) {
    return res.status(400).json({ error: "Tracking number is required." });
  }

  try {
    const pool = await getConnection();

    const result = await pool.request()
      .input("id", sql.Int, id)
      .input("trackingNumber", sql.NVarChar, trackingNumber)
      .query(`
        UPDATE orders
        SET tracking_number = @trackingNumber
        WHERE id = @id
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: "Order not found." });
    }

    res.json({ message: "Tracking number updated successfully." });
  } catch (error) {
    console.error("Error updating tracking number:", error.message);
    res.status(500).json({ error: "Failed to update tracking number." });
  }
});

// Route to fetch user information
app.get("/api/user-info", authenticateToken, async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input("userId", sql.Int, req.user.id)
            .query(`
                SELECT id, first_name, last_name, email, address
                FROM Users
                WHERE id = @userId
            `);

        const user = result.recordset[0];
        if (!user) return res.status(404).json({ error: "User not found." });

        res.json(user);
    } catch (error) {
        console.error("Error fetching user information:", error.message);
        res.status(500).json({ error: "Failed to fetch user information." });
    }
});

app.post("/api/cart/sync", async (req, res) => {
    const { items } = req.body;
    const sessionId = req.cookies.session_id;

    if (!items || !Array.isArray(items)) {
        return res.status(400).json({ error: "Invalid cart data." });
    }

    if (!sessionId) {
        return res.status(400).json({ error: "Session ID is required to sync the cart." });
    }

    try {
        const pool = await getConnection();

        // Clear existing cart items for the session
        await pool.request()
            .input("sessionId", sql.NVarChar, sessionId)
            .query(`
                DELETE FROM Cart
                WHERE session_id = @sessionId
            `);

        // Insert new cart items
        for (const item of items) {
            await pool.request()
                .input("sessionId", sql.NVarChar, sessionId)
                .input("productId", sql.Int, item.id)
                .input("quantity", sql.Int, item.quantity)
                .query(`
                    INSERT INTO Cart (session_id, product_id, quantity, created_at, updated_at)
                    VALUES (@sessionId, @productId, @quantity, GETDATE(), GETDATE())
                `);
        }

        res.json({ message: "Cart synchronized successfully." });
    } catch (error) {
        console.error("Error syncing cart:", error.message);
        res.status(500).json({ error: "Failed to sync cart." });
    }
});

app.put("/api/categories/:id", async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
        return res.status(400).json({ error: "Category name is required." });
    }

    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input("id", sql.Int, id)
            .input("name", sql.NVarChar, name)
            .query(`
                UPDATE Categories
                SET Name = @name
                WHERE CategoryID = @id
            `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: "Category not found." });
        }

        res.json({ message: "Category updated successfully." });
    } catch (error) {
        console.error("Error updating category:", error.message);
        res.status(500).json({ error: "Failed to update category." });
    }
});

app.get("/api/admin/orders/:id/items", async (req, res) => {
  const { id } = req.params;

  try {
    const pool = await getConnection();

    // Fetch order items for the given order ID, including the image_url
    const result = await pool.request()
      .input("orderId", sql.Int, id)
      .query(`
        SELECT oi.product_id AS productId, 
               p.name AS productName, 
               oi.quantity, 
               oi.price, 
               p.image_url AS imageUrl
        FROM order_items oi
        INNER JOIN Products p ON oi.product_id = p.id
        WHERE oi.order_id = @orderId
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: "No items found for this order." });
    }

    res.json(result.recordset);
  } catch (error) {
    console.error("Error fetching order items:", error.message);
    res.status(500).json({ error: "Failed to fetch order items." });
  }
});

app.get("/api/admin/orders/:id/user", async (req, res) => {
  const { id } = req.params;

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input("orderId", sql.Int, id)
      .query(`
        SELECT u.first_name, u.last_name, u.email, u.phone, u.address
        FROM orders o
        INNER JOIN Users u ON o.user_id = u.id
        WHERE o.id = @orderId
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: "User not found for this order." });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    console.error("Error fetching user information:", error.message);
    res.status(500).json({ error: "Failed to fetch user information." });
  }
});

app.post("/api/create-checkout-session", async (req, res) => {
  const { cartItems } = req.body;
  const userId = req.user?.id || "guest"; // Use user ID if available, otherwise "guest"

  try {
    if (!cartItems || cartItems.length === 0) {
      console.error("Cart items are missing or empty:", cartItems);
      return res.status(400).json({ error: "Cart items are required." });
    }

    const lineItems = cartItems.map((item) => ({
      price_data: {
        currency: "usd",
        product_data: {
          name: item.name,
          images: [item.image_url],
        },
        unit_amount: Math.round(item.price * 100),
      },
      quantity: item.quantity,
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: `${req.headers.origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/cancel.html`,
      metadata: {
        cartItems: JSON.stringify(cartItems),
        userId: userId, // Pass "guest" or the actual user ID
      },
    });

    console.log("Stripe Checkout session created successfully:", session.id);
    res.json({ url: session.url });
  } catch (error) {
    console.error("Error creating checkout session:", error.message);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

app.post("/api/confirm-order", authenticateToken, async (req, res) => {
  const { session_id } = req.query;

  if (!session_id) {
    console.error("Session ID is missing in the request.");
    return res.status(400).json({ error: "Session ID is required." });
  }

  try {
    console.log("Received request to confirm order. Session ID:", session_id);

    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (!session) {
      console.error(`Stripe session not found for session ID: ${session_id}`);
      return res.status(404).json({ error: "Stripe session not found." });
    }

    console.log("Session metadata:", session.metadata);

    const cartItems = JSON.parse(session.metadata.cartItems || "[]");
    const total = session.amount_total / 100;

    console.log("Cart items:", cartItems);
    console.log("Total amount:", total);

    if (!cartItems.length) {
      console.error("Cart items are empty. Cannot process order.");
      return res.status(400).json({ error: "Cart items are required to process the order." });
    }

    // Ensure the user ID is valid
    const userId = req.user?.id;
    if (!userId) {
      console.error("User ID is missing or invalid. User must create an account.");
      return res.status(401).json({ error: "User authentication required. Please log in or create an account." });
    }

    const pool = await getConnection();

    // Verify the user exists in the database
    const userResult = await pool.request()
      .input("userId", sql.Int, userId)
      .query("SELECT id FROM Users WHERE id = @userId");

    if (userResult.recordset.length === 0) {
      console.error("User not found in the database. User must create an account.");
      return res.status(404).json({ error: "User not found. Please create an account." });
    }

    // Insert order into Orders table
    const orderResult = await pool.request()
      .input("userId", sql.Int, userId)
      .input("total", sql.Decimal(10, 2), total)
      .query(`
        INSERT INTO orders (user_id, total_amount, created_at)
        OUTPUT INSERTED.id
        VALUES (@userId, @total, GETDATE())
      `);
    const orderId = orderResult.recordset[0]?.id;

    if (!orderId) {
      console.error("Failed to insert order. No order ID returned.");
      return res.status(500).json({ error: "Failed to insert order." });
    }

    console.log("Order ID:", orderId);

    // Insert order items into the order_items table and update stock
    for (const item of cartItems) {
      console.log("Processing item:", item);

      await pool.request()
        .input("orderId", sql.Int, orderId)
        .input("productId", sql.Int, item.id)
        .input("quantity", sql.Int, item.quantity)
        .input("price", sql.Decimal(10, 2), item.price)
        .query(`
          INSERT INTO order_items (order_id, product_id, quantity, price)
          VALUES (@orderId, @productId, @quantity, @price)
        `);

      console.log("Inserted order item for product ID:", item.id);

      await pool.request()
        .input("productId", sql.Int, item.id)
        .input("quantity", sql.Int, item.quantity)
        .query(`
          UPDATE Products
          SET stock_quantity = stock_quantity - @quantity
          WHERE id = @productId
        `);

      console.log("Updated stock for product ID:", item.id);
    }

    console.log("Order and order items inserted successfully for user ID:", userId);
    res.json({ message: "Order confirmed successfully." });
  } catch (error) {
    console.error("Error confirming order:", error.message);
    res.status(500).json({ error: "Failed to confirm order." });
  }
});

app.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error("Webhook signature verification failed:", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        console.log("Webhook received for session:", session.id);
        console.log("Session metadata:", session.metadata);
        const cartItems = JSON.parse(session.metadata.cartItems || "[]");
        const userId = parseInt(session.metadata.userId, 10);
        console.log("Cart items:", cartItems);
        console.log("User ID:", userId);
        try {
            const pool = await getConnection();
            const total = session.amount_total / 100; // Convert from cents to dollars
            console.log("Processing order for user ID:", userId);
            console.log("Total amount:", total);
            // Insert order into Orders table
            const orderResult = await pool.request()
                .input("userId", sql.Int, userId)
                .input("total", sql.Decimal(10, 2), total)
                .query(`
                    INSERT INTO orders (user_id, total_amount, created_at)
                    OUTPUT INSERTED.id
                    VALUES (@userId, @total, GETDATE())
                `);
            const orderId = orderResult.recordset[0]?.id;
            if (!orderId) {
                console.error("Failed to insert order. No order ID returned.");
                return res.status(500).send("Failed to insert order.");
            }
            console.log("Order ID:", orderId);
            // Insert order items into the order_items table and update stock
            for (const item of cartItems) {
                console.log("Processing item:", item);
                await pool.request()
                    .input("orderId", sql.Int, orderId)
                    .input("productId", sql.Int, item.id)
                    .input("quantity", sql.Int, item.quantity)
                    .input("price", sql.Decimal(10, 2), item.price)
                    .query(`
                        INSERT INTO order_items (order_id, product_id, quantity, price)
                        VALUES (@orderId, @productId, @quantity, @price)
                    `);
                console.log("Inserted order item for product ID:", item.id);
                // Reduce stock
                await pool.request()
                    .input("productId", sql.Int, item.id)
                    .input("quantity", sql.Int, item.quantity)
                    .query(`
                        UPDATE Products
                        SET stock_quantity = stock_quantity - @quantity
                        WHERE id = @productId
                    `);
                console.log("Updated stock for product ID:", item.id);
            }
            console.log("Order and order items inserted successfully for user ID:", userId);
        } catch (error) {
            console.error("Error handling checkout session completed webhook:", error.message);
            console.error("Stack trace:", error.stack);
            return res.status(500).send("Failed to process order.");
        }
    }
    res.status(200).send("Webhook received");
});

app.post("/api/paypal/create-order", async (req, res) => {
    try {
        const { items, total } = req.body;
        if (!items || items.length === 0 || !total) {
            return res.status(400).json({ error: "Invalid request. Items and total are required." });
        }
        // Create PayPal order
        const request = new paypal.orders.OrdersCreateRequest();
        request.prefer("return=representation");
        request.requestBody({
            intent: "CAPTURE",
            purchase_units: [
                {
                    amount: {
                        currency_code: "USD",
                        value: total.toFixed(2),
                    },
                },
            ],
        });
        const order = await paypalClient.execute(request);
        res.json({ orderId: order.result.id });
    } catch (error) {
        console.error("Error creating PayPal order:", error.message);
        res.status(500).json({ error: "Failed to create PayPal order." });
    }
});

app.post("/api/paypal/capture-order", async (req, res) => {
    try {
        const { orderId } = req.body;
        if (!orderId) {
            return res.status(400).json({ error: "Order ID is required." });
        }
        // Capture PayPal order
        const request = new paypal.orders.OrdersCaptureRequest(orderId);
        request.requestBody({});
        const capture = await paypalClient.execute(request);
        res.json({ message: "Order captured successfully.", capture });
    } catch (error) {
        console.error("Error capturing PayPal order:", error.message);
        res.status(500).json({ error: "Failed to capture PayPal order." });
    }
});

app.post("/api/admin/orders/:id/send-email", async (req, res) => {
  const { id } = req.params;
  const { email, trackingNumber } = req.body;

  if (!email || !trackingNumber) {
    return res.status(400).json({ error: "Email and tracking number are required." });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail", // Use your email service provider
      auth: {
        user: process.env.EMAIL_USER, // Your email address
        pass: process.env.EMAIL_PASS, // Your email password
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "BladeZ - Product Shipped",
      text: `Dear Customer,

Your order has been shipped! Here is your tracking number: ${trackingNumber}.

To view your order details, please log in to the BladeZ website and navigate to the "My Orders" section.

BladeZ Website: http://localhost:5000/landing.html

Thank you for shopping with BladeZ!

Best regards,
BladeZ Team`,
      html: `
        <p>Dear Customer,</p>
        <p>Your order has been shipped! Here is your tracking number: <strong>${trackingNumber}</strong>.</p>
        <p>To view your order details, please log in to the BladeZ website and navigate to the "My Orders" section.</p>
        <p><a href="http://localhost:5000/landing.html" style="color: blue; text-decoration: underline;">BladeZ Website</a></p>
        <p>Thank you for shopping with BladeZ!</p>
        <p>Best regards,<br>BladeZ Team</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.json({ message: "Email sent successfully." });
  } catch (error) {
    console.error("Error sending email:", error.message);
    res.status(500).json({ error: "Failed to send email." });
  }
});

app.listen(PORT, () => console.log(`Server running on ${BACKEND_URL}:${PORT}`));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err.message);
  res.status(500).json({ error: "Internal Server Error" });
});
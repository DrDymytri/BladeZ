require("dotenv").config();
const express = require("express");
const cors = require("cors");
const sql = require("mssql");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const path = require("path");
const multer = require("multer");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const nodemailer = require("nodemailer");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY); // Ensure STRIPE_SECRET_KEY is set in .env
const jwt = require("jsonwebtoken");

const SECRET_KEY = process.env.JWT_SECRET;
const PORT = 5000;

const app = express();

// Middleware
app.use(cors({ origin: "http://localhost:5000", credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public"))); // Ensure this line exists and serves the 'public' folder
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
            request.input("categoryId", sql.Int, categoryId);
        }
        if (subCategoryId) {
            query += " AND sub_category_id = @subCategoryId";
            request.input("subCategoryId", sql.Int, subCategoryId);
        }
        if (descriptorId) {
            query += " AND tag_id = @descriptorId";
            request.input("descriptorId", sql.Int, descriptorId);
        }
        query += `
            ORDER BY name ASC
            OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
        `;
        request.input("offset", sql.Int, (page - 1) * limit);
        request.input("limit", sql.Int, limit);

        const result = await request.query(query);

        if (result.recordset.length === 0) {
            return res.json({ products: [], total: 0 });
        }

        // Fetch total count for pagination
        const totalResult = await pool.request().query("SELECT COUNT(*) AS total FROM Products");
        const total = totalResult.recordset[0].total;

        res.json({ products: result.recordset, total });
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
                SELECT id, name, description, price, stock_quantity, image_url, category_id, sub_category_id, tag_id
                FROM Products
                WHERE id = @id
            `);
        const product = result.recordset[0];
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
    const { name, description, price, stock_quantity, category_id, sub_category_id, tag_id, image_url, is_showcase } = req.body;

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
            .query(`
                INSERT INTO Products (name, description, price, stock_quantity, category_id, sub_category_id, tag_id, image_url, is_showcase)
                OUTPUT INSERTED.id, INSERTED.name, INSERTED.description, INSERTED.price, INSERTED.stock_quantity, INSERTED.category_id, INSERTED.sub_category_id, INSERTED.tag_id, INSERTED.image_url, INSERTED.is_showcase
                VALUES (@name, @description, @price, @stock_quantity, @category_id, @sub_category_id, @tag_id, @image_url, @is_showcase)
            `);

        res.status(201).json(result.recordset[0]);
    } catch (error) {
        console.error("Error creating product:", error.message);
        res.status(500).json({ error: "Failed to create product." });
    }
});

app.put("/api/products/:id", async (req, res) => {
    const { id } = req.params;
    const { name, description, price, stock_quantity, category_id, sub_category_id, tag_id, image_url, is_showcase } = req.body;

    if (!name || !price || !stock_quantity || !category_id) {
        return res.status(400).json({ error: "Name, price, stock quantity, and category ID are required." });
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
                    is_showcase = @is_showcase
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
    try {
        const pool = await getConnection();

        // Fetch all orders with user details
        const result = await pool.request().query(`
            SELECT o.id AS id, 
                   o.total_amount AS total_amount, 
                   o.status AS status,
                   o.tracking_number AS tracking_number,
                   o.created_at AS created_at, 
                   u.first_name + ' ' + u.last_name AS user_name
            FROM orders o
            LEFT JOIN Users u ON o.user_id = u.id
            ORDER BY o.created_at DESC
        `);

        const orders = result.recordset;

        console.log("Orders fetched from database:", orders); // Debugging log

        if (orders.length === 0) {
            console.log("No orders found in the database."); // Debugging log
            return res.json([]); // Return an empty array if no orders are found
        }

        res.json(orders);
    } catch (error) {
        console.error("Error fetching admin orders:", error.message);
        res.status(500).json({ error: "Failed to fetch orders." });
    }
});

app.put("/api/admin/orders/:id/status", async (req, res) => {
    const { id } = req.params;
    const { status, trackingNumber } = req.body;

    if (!status) {
        return res.status(400).json({ error: "Order status is required." });
    }

    try {
        const pool = await getConnection();

        const result = await pool.request()
            .input("id", sql.Int, id)
            .input("status", sql.NVarChar, status)
            .input("trackingNumber", sql.NVarChar, trackingNumber || null)
            .query(`
                UPDATE orders
                SET status = @status,
                    tracking_number = @trackingNumber
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
    const userId = req.user?.id || null; // Use user ID if logged in, otherwise null

    if (!items || !Array.isArray(items)) {
        return res.status(400).json({ error: "Invalid cart data." });
    }

    try {
        const pool = await getConnection();

        // Clear existing cart items for the user or session
        await pool.request()
            .input("userId", sql.Int, userId)
            .input("sessionId", sql.NVarChar, sessionId)
            .query(`
                DELETE FROM Cart
                WHERE (user_id = @userId OR session_id = @sessionId)
            `);

        // Insert new cart items
        for (const item of items) {
            await pool.request()
                .input("userId", sql.Int, userId)
                .input("sessionId", sql.NVarChar, sessionId)
                .input("productId", sql.Int, item.id)
                .input("quantity", sql.Int, item.quantity)
                .query(`
                    INSERT INTO Cart (user_id, session_id, product_id, quantity, created_at, updated_at)
                    VALUES (@userId, @sessionId, @productId, @quantity, GETDATE(), GETDATE())
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

// Start the server
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

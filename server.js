require("dotenv").config();

const express = require("express");
const cors = require("cors");
const sql = require("mssql");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt"); // Replace bcryptjs with bcrypt
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const nodemailer = require("nodemailer");
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
    console.error("STRIPE_SECRET_KEY is not defined. Check your .env file.");
    throw new Error("STRIPE_SECRET_KEY is not defined in the .env file.");
}

const stripe = require("stripe")(stripeSecretKey);
const jwt = require("jsonwebtoken");
const paypal = require("@paypal/checkout-server-sdk");
const { BlobServiceClient } = require("@azure/storage-blob");
const formidable = require("formidable"); // For parsing form-data

const SECRET_KEY = process.env.JWT_SECRET;
const PORT = process.env.PORT || 5000;
const BACKEND_URL = process.env.RENDER_EXTERNAL_URL || "https://bladez-backend.onrender.com"; // Ensure public-facing URL

if (!BACKEND_URL) {
  console.error("RENDER_EXTERNAL_URL is not defined. Check your Render configuration.");
  throw new Error("RENDER_EXTERNAL_URL is required but not defined.");
}

console.log(`Using BACKEND_URL: ${BACKEND_URL}`); // Log the URL for debugging

// Initialize PayPal client
const paypalClient = new paypal.core.PayPalHttpClient(
    new paypal.core.SandboxEnvironment(
        process.env.PAYPAL_CLIENT_ID,
        process.env.PAYPAL_CLIENT_SECRET
    )
);

const app = express();

// Middleware
app.use(cors({
    origin: ['https://pointfxbladez.com', 'https://wayne.github.io'], // Allow specific origins
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Include OPTIONS for preflight requests
    credentials: true, // Allow cookies and authorization headers
}));

// Ensure proper CORS headers for all responses
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'https://pointfxbladez.com'); // Allow the frontend origin
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(204); // Respond to preflight requests
    }
    next();
});

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname))); // Serve static files from root directory
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

// Database configuration for Azure SQL
const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT) || 1433,
    options: {
        encrypt: true, // Azure SQL requires encryption
        trustServerCertificate: false, // Ensure secure connections
    },
};

// Ensure connection to Azure SQL Database
let pool;
async function getConnection() {
    try {
        if (!pool || !pool.connected) {
            pool = await sql.connect(dbConfig);
            console.log("✅ Connected to Azure SQL Database.");
        }
        return pool;
    } catch (error) {
        console.error("❌ Database connection error:", error.message);
        throw error;
    }
}

// Ensure upload folders exist
["uploads", "uploads/images", "uploads/videos"].forEach((folder) => {
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
});

// Routes
app.get("/", (req, res) => {
  res.send(`Server running on ${BACKEND_URL}`);
});

app.get("/api/categories", async (req, res) => {
    try {
        console.log("Fetching categories from the database...");
        const pool = await getConnection();
        const result = await pool.request().query(`
            SELECT CategoryID AS id, Name AS name 
            FROM Categories
            ORDER BY Name ASC
        `);
        if (!result.recordset.length) {
            console.warn("No categories found in the database.");
            return res.status(404).json({ error: "No categories found." });
        }
        console.log("Categories fetched successfully:", result.recordset);
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
    const { categoryId, subCategoryId, descriptorId, page = 1, limit = 20 } = req.query;

    try {
        console.log("Fetching products with filters:", { categoryId, subCategoryId, descriptorId, page, limit });
        const pool = await getConnection();

        let query = `
            SELECT id, name, description, price, stock_quantity, image_url, is_showcase
            FROM Products
            WHERE 1=1
        `;
        const request = pool.request();

        if (categoryId) {
            query += " AND CategoryID = @categoryId";
            request.input("categoryId", sql.Int, categoryId);
        }
        if (subCategoryId) {
            query += " AND SubCategoryID = @subCategoryId";
            request.input("subCategoryId", sql.Int, subCategoryId);
        }
        if (descriptorId) {
            query += " AND DescriptorID = @descriptorId";
            request.input("descriptorId", sql.Int, descriptorId);
        }

        query += " ORDER BY name ASC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY";
        const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
        request.input("offset", sql.Int, offset);
        request.input("limit", sql.Int, parseInt(limit, 10));

        const result = await request.query(query);
        console.log("Products fetched successfully:", result.recordset);

        const totalProductsQuery = `
            SELECT COUNT(*) AS total
            FROM Products
            WHERE 1=1
        `;
        const totalProductsResult = await pool.request().query(totalProductsQuery);
        const totalProducts = totalProductsResult.recordset[0].total;

        res.json({
            products: result.recordset,
            totalPages: Math.ceil(totalProducts / limit),
            totalProducts,
        });
    } catch (error) {
        console.error("Error fetching products:", error.message);
        res.status(500).json({ error: "Failed to fetch products." });
    }
});

app.get("/api/showcase-products", async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input("limit", sql.Int, parseInt(limit, 10))
      .input("offset", sql.Int, parseInt(offset, 10))
      .query(`
        SELECT ProductID AS id, Name AS name, Description AS description, Price AS price, ImageURL AS image_url
        FROM Products
        WHERE IsShowcase = 1
        ORDER BY Name ASC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
      `);

    const totalResult = await pool.request()
      .query(`SELECT COUNT(*) AS total FROM Products WHERE IsShowcase = 1`);

    const totalProducts = totalResult.recordset[0].total;
    const totalPages = Math.ceil(totalProducts / limit);

    res.json({ products: result.recordset, totalPages, totalProducts });
  } catch (error) {
    console.error("Error fetching showcase products:", error.message);
    res.status(500).json({ error: "Failed to fetch showcase products." });
  }
});

app.get("/api/categories", async (req, res) => {
    try {
        console.log("Fetching categories from the database...");
        const pool = await getConnection();
        const result = await pool.request().query(`
            SELECT CategoryID AS id, Name AS name 
            FROM Categories
            ORDER BY Name ASC
        `);
        if (!result.recordset.length) {
            console.warn("No categories found in the database.");
            return res.status(404).json({ error: "No categories found." });
        }
        console.log("Categories fetched successfully:", result.recordset);
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

app.get("/api/events", async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request().query(`
            SELECT 
                id,
                title,
                description,
                event_start_date,
                event_end_date,
                location,
                event_website,
                created_at
            FROM Events
            WHERE event_end_date >= GETDATE()
            ORDER BY event_start_date ASC
        `);
        
        if (!result.recordset.length) {
            return res.json([]); // Return empty array instead of 404 for better UX
        }
        
        res.json(result.recordset);
    } catch (error) {
        console.error("Error fetching events:", error.message);
        console.error("Stack trace:", error.stack);
        res.status(500).json({ error: "Failed to fetch events." });
    }
});

app.post("/api/events", async (req, res) => {
    const { title, description, event_start_date, event_end_date, location, event_website } = req.body;

    if (!title || !event_start_date || !event_end_date || !location) {
        return res.status(400).json({ error: "Title, start date, end date, and location are required." });
    }

    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input("title", sql.NVarChar, title)
            .input("description", sql.NVarChar, description || "")
            .input("event_start_date", sql.DateTime, new Date(event_start_date))
            .input("event_end_date", sql.DateTime, new Date(event_end_date))
            .input("location", sql.NVarChar, location)
            .input("event_website", sql.NVarChar, event_website || null)
            .query(`
                INSERT INTO Events (title, description, event_start_date, event_end_date, location, event_website)
                OUTPUT INSERTED.id, INSERTED.title, INSERTED.description, INSERTED.event_start_date, INSERTED.event_end_date, INSERTED.location, INSERTED.event_website
                VALUES (@title, @description, @event_start_date, @event_end_date, @location, @event_website)
            `);

        res.status(201).json(result.recordset[0]);
    } catch (error) {
        console.error("Error creating event:", error.message);
        res.status(500).json({ error: "Failed to create event." });
    }
});

app.put("/api/events/:id", async (req, res) => {
    const { id } = req.params;
    const { title, description, event_start_date, event_end_date, location, event_website } = req.body;

    if (!title || !event_start_date || !event_end_date || !location) {
        return res.status(400).json({ error: "Title, start date, end date, and location are required." });
    }

    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input("id", sql.Int, id)
            .input("title", sql.NVarChar, title)
            .input("description", sql.NVarChar, description || "")
            .input("event_start_date", sql.DateTime, new Date(event_start_date))
            .input("event_end_date", sql.DateTime, new Date(event_end_date))
            .input("location", sql.NVarChar, location)
            .input("event_website", sql.NVarChar, event_website || null)
            .query(`
                UPDATE Events
                SET title = @title, description = @description, event_start_date = @event_start_date, 
                    event_end_date = @event_end_date, location = @location, event_website = @event_website
                WHERE id = @id
            `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: "Event not found." });
        }

        res.json({ message: "Event updated successfully." });
    } catch (error) {
        console.error("Error updating event:", error.message);
        res.status(500).json({ error: "Failed to update event." });
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
            return res.status(404).json({ error: "Event not found." });
        }

        res.json({ message: "Event deleted successfully." });
    } catch (error) {
        console.error("Error deleting event:", error.message);
        res.status(500).json({ error: "Failed to delete event." });
    }
});

// Endpoint to fetch images
app.get("/api/images", async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .query(`
                SELECT id, url, title, description 
                FROM Media 
                WHERE type = 'image'
                ORDER BY title ASC
            `);
        if (!result.recordset.length) {
            return res.status(404).json({ error: "No images found." });
        }
        res.json(result.recordset);
    } catch (err) {
        console.error("Error fetching images:", err.message);
        res.status(500).json({ error: "Failed to fetch images." });
    }
});

// Endpoint to fetch videos
app.get("/api/videos", async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .query(`
                SELECT id, url, title, description 
                FROM Media 
                WHERE type = 'video'
                ORDER BY title ASC
            `);
        if (!result.recordset.length) {
            return res.status(404).json({ error: "No videos found." });
        }
        res.json(result.recordset);
    } catch (err) {
        console.error("Error fetching videos:", err.message);
        res.status(500).json({ error: "Failed to fetch videos." });
    }
});

app.get("/api/low-stock-products", async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request().query(`
            SELECT id, name, stock_quantity, restock_threshold
            FROM Products
            WHERE stock_quantity <= restock_threshold
            ORDER BY stock_quantity ASC
        `);

        if (!result.recordset.length) {
            return res.status(404).json({ error: "No low-stock products found." });
        }

        res.json(result.recordset);
    } catch (error) {
        console.error("Error fetching low-stock products:", error.message);
        res.status(500).json({ error: "Failed to fetch low-stock products." });
    }
});

app.post("/api/cart", async (req, res) => {
  const { productId, quantity } = req.body;

  if (!productId || !quantity) {
    return res.status(400).json({ error: "Product ID and quantity are required." });
  }

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input("productId", sql.Int, productId)
      .input("quantity", sql.Int, quantity)
      .query(`
        INSERT INTO Cart (ProductID, Quantity)
        VALUES (@productId, @quantity)
      `);

    res.status(201).json({ message: "Product added to cart successfully." });
  } catch (error) {
    console.error("Error adding product to cart:", error.message);
    res.status(500).json({ error: "Failed to add product to cart." });
  }
});

// Azure Blob Storage configuration
const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;

console.log("Azure Storage Connection String:", AZURE_STORAGE_CONNECTION_STRING); // Debug log

if (!AZURE_STORAGE_CONNECTION_STRING) {
  throw new Error("Azure Storage connection string is not defined in the environment variables.");
}

const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
const containerName = "uploads"; // Replace with your container name

app.post("/upload", (req, res) => {
  const form = new formidable.IncomingForm();

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("Error parsing form data:", err);
      return res.status(400).send("Failed to parse form data.");
    }

    const file = files.file; // Assuming the file input field is named "file"
    const blobName = `${Date.now()}-${file.originalFilename}`;
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    try {
      await blockBlobClient.uploadFile(file.filepath); // Upload file directly to Azure Blob Storage
      res.status(200).send({ message: "File uploaded successfully.", blobUrl: blockBlobClient.url });
    } catch (uploadError) {
      console.error("Error uploading file to Azure Blob Storage:", uploadError);
      res.status(500).send("Failed to upload file.");
    }
  });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
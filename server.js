require("dotenv").config();
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

if (!stripeSecretKey) {
    console.error("STRIPE_SECRET_KEY is not defined. Check your .env file.");
    throw new Error("STRIPE_SECRET_KEY is not defined in the .env file.");
}

const stripe = require("stripe")(stripeSecretKey);
const jwt = require("jsonwebtoken");
const paypal = require("@paypal/checkout-server-sdk");

const SECRET_KEY = process.env.JWT_SECRET;
const PORT = process.env.PORT || 5000;
const BACKEND_URL = process.env.RENDER_EXTERNAL_URL; // Use Render's external URL

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
const allowedOrigins = [process.env.FRONTEND_URL]; // Ensure FRONTEND_URL is allowed
app.use(cors({
  origin: ['https://pointfxbladez.com'], // Allow your frontend domain
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // Restrict allowed methods
  credentials: true // Allow cookies and authorization headers
}));
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

// Database configuration
const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT) || 1433,
    options: {
        encrypt: true, // Azure SQL requires encryption
        trustServerCertificate: false, // Set to false for secure connections
    },
};

// Global connection pool
let pool;

async function getConnection() {
    try {
        console.log("Attempting to connect to the database with config:", dbConfig);
        if (!pool || !pool.connected) {
            pool = await sql.connect(dbConfig);
            console.log("✅ Database connection established.");
        }
        return pool;
    } catch (error) {
        console.error("❌ Error establishing database connection:", error.message);
        console.error("Stack trace:", error.stack);
        if (error.message.includes("Client with IP address")) {
            console.error("⚠️ Ensure the IP address is allowed in Azure SQL Firewall settings.");
        }
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
app.get("/", (req, res) => {
  res.send(`Server running on ${BACKEND_URL}`);
});

app.get("/api/categories", async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request().query(`
            SELECT CategoryID AS id, Name AS name 
            FROM Categories
            ORDER BY Name ASC
        `);
        if (!result.recordset.length) {
            return res.status(404).json({ error: "No categories found." });
        }
        res.json(result.recordset);
    } catch (error) {
        console.error("Error fetching categories:", error.message);
        console.error("Stack trace:", error.stack); // Log stack trace for debugging
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

// Events endpoint
app.get("/api/events", async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request().query(`
            SELECT 
                id, 
                title, 
                description, 
                event_start_date AS startDate, 
                event_end_date AS endDate, 
                location, 
                event_website 
            FROM Events
            ORDER BY event_start_date ASC
        `);
        res.json(result.recordset);
    } catch (error) {
        console.error("Error fetching events:", error.message);
        res.status(500).json({ error: "Failed to fetch events." });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
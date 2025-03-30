require("dotenv").config();
console.log("EMAIL_USER:", process.env.EMAIL_USER);
console.log("EMAIL_PASS:", process.env.EMAIL_PASS ? "Loaded" : "Not Loaded");
const express = require("express");
const cors = require("cors");
const sql = require("mssql");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const multer = require("multer");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid"); // Add this for generating session IDs
const nodemailer = require("nodemailer"); // Add this for sending emails

const SECRET_KEY = process.env.JWT_SECRET;

const app = express();
const PORT = 5000; // Explicitly set to 5000

// Middleware
app.use(cors({ origin: "http://localhost:5000", credentials: true })); // Corrected syntax
app.use(express.json());
app.use(cookieParser());
app.use(express.static(__dirname + "/public"));
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Middleware to ensure session_id for guest users
app.use((req, res, next) => {
  if (!req.cookies.session_id) {
    res.cookie("session_id", uuidv4(), { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 }); // 7 days
  }
  next();
});

// Database configuration
const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT) || 1433,
  options: {
    encrypt: process.env.DB_ENCRYPT === "true", // Ensure encryption is correctly set
    trustServerCertificate: true, // For local development
  },
};

// Global connection pool
let pool;

async function getConnection() {
    try {
        if (!pool || !pool.connected) {
            pool = await sql.connect(dbConfig);
            console.log("✅ Database connection established.");
        }
        return pool;
    } catch (error) {
        console.error("❌ Error establishing database connection:", error.message);
        throw error;
    }
}

// Utility function to convert a date to UTC
function toUTC(date) {
  return new Date(date).toISOString(); // Convert to ISO string in UTC
}

// Utility function to convert a UTC date to local time
function toLocalTime(utcDate) {
  return new Date(utcDate).toLocaleString("en-US", { timeZone: "America/New_York" }); // Adjust to Eastern Time
}

// Utility function to send emails
async function sendEmail(to, subject, html) {
  try {
    console.log("Attempting to send email...");
    console.log("EMAIL_USER:", process.env.EMAIL_USER);
    console.log("EMAIL_PASS:", process.env.EMAIL_PASS ? "Loaded" : "Not Loaded");

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const info = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      html,
    });

    console.log("Email sent successfully:", info.messageId);
  } catch (error) {
    console.error("Error sending email:", error.message);
    console.error("Full error details:", error);
  }
}

// Deduct inventory when an order is placed
async function deductInventory(items) {
  const pool = await getConnection();
  let insufficientStock = false;

  for (const item of items) {
    const result = await pool.request()
      .input("productId", sql.Int, item.id)
      .query("SELECT stock_quantity FROM Products WHERE id = @productId");

    const stock = result.recordset[0]?.stock_quantity || 0;

    if (stock < item.quantity) {
      insufficientStock = true; // Flag insufficient stock
    }

    // Allow negative stock values
    await pool.request()
      .input("productId", sql.Int, item.id)
      .input("quantity", sql.Int, item.quantity)
      .query("UPDATE Products SET stock_quantity = stock_quantity - @quantity WHERE id = @productId");
  }

  return insufficientStock;
}

app.post('/api/products', async (req, res) => {
  const { name, description, price, image_url, stock_quantity, category_id, sub_category_id, tag_id, is_showcase } = req.body;
  // Validate required fields
  if (!name || !description || !price || !stock_quantity || !category_id) {
      return res.status(400).send("Missing required fields.");
  }

  try {
      const pool = await getConnection();
      await pool.request()
          .input("name", sql.NVarChar, name)
          .input("description", sql.NVarChar, description)
          .input("price", sql.Decimal(18, 2), price)
          .input("image_url", sql.NVarChar, image_url || null) // Allow null for optional fields
          .input("stock_quantity", sql.Int, stock_quantity)
          .input("category_id", sql.Int, category_id)
          .input("sub_category_id", sql.Int, sub_category_id || null) // Allow null for optional fields
          .input("tag_id", sql.Int, tag_id || null) // Allow null for optional fields
          .input("is_showcase", sql.Bit, is_showcase || false) // Default to false if not provided
          .query(`
              INSERT INTO Products (name, description, price, image_url, stock_quantity, category_id, sub_category_id, tag_id, is_showcase, created_at, updated_at)
              VALUES (@name, @description, @price, @image_url, @stock_quantity, @category_id, @sub_category_id, @tag_id, @is_showcase, GETDATE(), GETDATE())
          `);

      res.status(201).send("Product added successfully.");
  } catch (error) {
      console.error("Error adding product:", error.message);
      res.status(500).send("Failed to add product.");
  }
});

app.get('/api/products/:id', async (req, res) => {
  const productId = req.params.id;

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('productId', sql.Int, productId)
      .query(`
        SELECT 
          id, 
          name, 
          description, 
          price, 
          image_url, 
          stock_quantity, 
          category_id, 
          sub_category_id, 
          tag_id, 
          is_showcase
        FROM Products 
        WHERE id = @productId
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    console.error('Error fetching product:', error.message);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

app.put('/api/products/:id', async (req, res) => {
  const productId = req.params.id;
  const { name, description, price, stock_quantity, image_url, category_id, sub_category_id, tag_id, is_showcase } = req.body;

  try {
      const pool = await getConnection();
      await pool.request()
          .input('productId', sql.Int, productId)
          .input('name', sql.NVarChar, name)
          .input('description', sql.NVarChar, description)
          .input('price', sql.Decimal(18, 2), price)
          .input('stock_quantity', sql.Int, stock_quantity)
          .input('image_url', sql.NVarChar, image_url)
          .input('category_id', sql.Int, category_id)
          .input('sub_category_id', sql.Int, sub_category_id)
          .input('tag_id', sql.Int, tag_id)
          .input('is_showcase', sql.Bit, is_showcase)
          .query(`
              UPDATE Products
              SET name = @name,
                  description = @description,
                  price = @price,
                  stock_quantity = @stock_quantity,
                  image_url = @image_url,
                  category_id = @category_id,
                  sub_category_id = @sub_category_id,
                  tag_id = @tag_id,
                  is_showcase = @is_showcase,
                  updated_at = GETDATE()
              WHERE id = @productId
          `);

      res.status(200).send("Product updated successfully.");
  } catch (error) {
      console.error("Error updating product:", error.message);
      res.status(500).send("Failed to update product.");
  }
});

app.get('/api/products', async (req, res) => {
  const { page = 1, limit = 30, categoryId, subCategoryId, descriptorId } = req.query;

  try {
    const pool = await getConnection();
    let query = `
      SELECT 
        p.id, 
        p.name, 
        p.description, 
        p.price, 
        p.stock_quantity, 
        p.image_url, 
        p.category_id, 
        c.name AS category_name, 
        p.sub_category_id, 
        sc.SubCategoryName AS subcategory_name, 
        p.tag_id, 
        t.DescriptorName AS tag_name, 
        p.is_showcase
      FROM Products p
      LEFT JOIN Categories c ON p.category_id = c.Categoryid
      LEFT JOIN SubCategories sc ON p.sub_category_id = sc.SubCategoryID
      LEFT JOIN Descriptors t ON p.tag_id = t.DescriptorID
      WHERE 1=1
    `;

    const request = pool.request();

    if (categoryId) {
      query += ` AND p.category_id = @categoryId`;
      request.input("categoryId", sql.Int, categoryId);
    }
    if (subCategoryId) {
      query += ` AND p.sub_category_id = @subCategoryId`;
      request.input("subCategoryId", sql.Int, subCategoryId);
    }
    if (descriptorId) {
      query += ` AND p.tag_id = @descriptorId`;
      request.input("descriptorId", sql.Int, descriptorId);
    }

    query += `
      ORDER BY p.name ASC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
    `;

    request.input("offset", sql.Int, (page - 1) * limit);
    request.input("limit", sql.Int, limit);

    const result = await request.query(query);
    res.json({ products: result.recordset });
  } catch (error) {
    console.error("Error fetching products:", error.message);
    res.status(500).json({ error: "Failed to fetch products." });
  }
});

app.get('/api/products', async (req, res) => {
  const ids = req.query.ids?.split(",").map((id) => parseInt(id)).filter((id) => !isNaN(id));

  if (!ids || ids.length === 0) {
    return res.status(400).json({ error: "No valid product IDs provided." });
  }

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input("ids", sql.NVarChar, ids.join(","))
      .query(`
        SELECT id, name, price, image_url 
        FROM Products 
        WHERE id IN (${ids.map((_, i) => `@id${i}`).join(",")})
      `);

    ids.forEach((id, i) => {
      result.request.input(`id${i}`, sql.Int, id);
    });

    res.json(result.recordset);
  } catch (error) {
    console.error("Error fetching products by IDs:", error.message);
    res.status(500).json({ error: "Failed to fetch products." });
  }
});

app.get('/admin/products', authenticateToken, async (req, res) => {
  try {
      const pool = await getConnection();
      const result = await pool.request()
          .query('SELECT id, name, description, price, image_url, stock_quantity FROM Products');
      res.json(result.recordset);
  } catch (error) {
      console.error('Error fetching products for admin:', error);
      res.status(500).json({ error: 'Failed to fetch products' });
  }
});


// Get showcase products
app.get('/api/showcase-products', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .query('SELECT id, name, description, price, image_url, stock_quantity FROM Products WHERE is_showcase = 1');
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching showcase products:', error);
    res.status(500).json({ error: 'Failed to fetch showcase products' });
  }
});

// Fix: Get categories
app.get('/api/categories', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request().query(`
      SELECT CategoryID AS id, Name AS name 
      FROM Categories
      ORDER BY Name ASC
    `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'No categories found.' });
    }

    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching categories:', error.message);
    res.status(500).json({ error: 'Failed to fetch categories.' });
  }
});

// Fix: Get subcategories
app.get('/api/subcategories', async (req, res) => {
  const { categoryId } = req.query;

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('categoryId', sql.Int, categoryId || null)
      .query(`
        SELECT SubCategoryID AS id, SubCategoryName AS name, CategoryID AS categoryId 
        FROM SubCategories 
        WHERE @categoryId IS NULL OR CategoryID = @categoryId
        ORDER BY SubCategoryName ASC
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'No subcategories found for the given category.' });
    }

    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching subcategories:', error.message);
    res.status(500).send('Failed to fetch subcategories.');
  }
});

// Fix: Get descriptors
app.get('/api/descriptors', async (req, res) => {
  const { subCategoryId } = req.query;

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('subCategoryId', sql.Int, subCategoryId || null)
      .query(`
        SELECT DescriptorID AS id, DescriptorName AS name, SubCategoryID AS subCategoryId 
        FROM Descriptors 
        WHERE @subCategoryId IS NULL OR SubCategoryID = @subCategoryId
        ORDER BY DescriptorName ASC
      `);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching descriptors:', error.message);
    res.status(500).send('Failed to fetch descriptors.');
  }
});

app.get('/api/subcategories', async (req, res) => {
    const { categoryId } = req.query;

    if (!categoryId) {
        return res.status(400).send('Category ID is required.');
    }

    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('categoryId', sql.Int, categoryId)
            .query(`
                SELECT SubCategoryID, SubCategoryName 
                FROM SubCategories 
                WHERE CategoryID = @categoryId
            `);

        if (result.recordset.length === 0) {
            return res.status(404).send('No subcategories found for the given category.');
        }

        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching subcategories:', error.message);
        res.status(500).send('Failed to fetch subcategories.');
    }
});


// Get descriptors
app.get('/api/descriptors', async (req, res) => {
  const { subCategoryId } = req.query;
  try {
      const pool = await getConnection();
      const result = await pool.request()
          .input('subCategoryId', sql.Int, subCategoryId)
          .query('SELECT DescriptorID, DescriptorName FROM Descriptors WHERE SubCategoryID = @subCategoryId');
      res.json(result.recordset);
  } catch (error) {
      console.error('Error fetching descriptors:', error);
      res.status(500).send('Failed to fetch descriptors.');
  }
});


function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Access denied. Invalid token format." });
  }

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid token" });
    }
    req.user = user; // Attach the decoded user object to the request
    next();
  });
}


// Admin login
app.post('/admin/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT id, email, password FROM Admin WHERE email = @Email');
    
    const admin = result.recordset[0];
    if (!admin) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: admin.id, email: admin.email }, SECRET_KEY, { expiresIn: '1h' });
    res.json({ token });
  } catch (error) {
    console.error('Error during admin login:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

app.get('/admin/events', authenticateToken, async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .query('SELECT id, title, description, event_start_date, event_end_date, location, event_website FROM Events');
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching admin events:', error);
    res.status(500).json({ error: 'Failed to fetch admin events' });
  }
});


// Get public events (accessible via /api/events)
app.get('/api/events', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .query('SELECT id, title, description, event_start_date, event_end_date, location, event_website FROM Events ORDER BY event_start_date ASC');

    console.log("Fetched Events:", result.recordset); // Debugging: Log the fetched events

    const events = result.recordset.map(event => ({
      id: event.id,
      title: event.title,
      description: event.description,
      event_start_date: new Date(event.event_start_date).toISOString(),
      event_end_date: new Date(event.event_end_date).toISOString(),
      location: event.location,
      event_website: event.event_website || "", // Ensure the field is named `event_website`
    }));

    res.json(events);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

app.put('/api/events/:id', async (req, res) => {
  const { id } = req.params;
  const { title, description, event_start_date, event_end_date, location, website } = req.body;

  if (!title || !description || !event_start_date || !event_end_date || !location || !website) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('title', sql.NVarChar, title)
      .input('description', sql.NVarChar, description)
      .input('event_start_date', sql.DateTime, new Date(event_start_date))
      .input('event_end_date', sql.DateTime, new Date(event_end_date))
      .input('location', sql.NVarChar, location)
      .input('website', sql.NVarChar, website) // Include website field
      .input('id', sql.Int, id)
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
      return res.status(404).json({ error: 'Event not found.' });
    }

    res.status(200).json({ message: 'Event updated successfully.' });
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({ error: 'An error occurred while updating the event.' });
  }
});

app.post('/api/events', async (req, res) => {
  const { title, description, event_start_date, event_end_date, location, website } = req.body;

  console.log("Received Event Data:", req.body); // Debugging: Log the incoming request data

  // Validate required fields
  if (!title || !description || !event_start_date || !event_end_date || !location || !website) {
    console.error("Validation failed: Missing required fields.");
    return res.status(400).send("Missing required fields.");
  }

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('title', sql.NVarChar, title)
      .input('description', sql.NVarChar, description)
      .input('event_start_date', sql.DateTime, new Date(event_start_date))
      .input('event_end_date', sql.DateTime, new Date(event_end_date))
      .input('location', sql.NVarChar, location)
      .input('website', sql.NVarChar, website) // Ensure website is included
      .query(`
        INSERT INTO Events (title, description, event_start_date, event_end_date, location, event_website)
        VALUES (@title, @description, @event_start_date, @event_end_date, @location, @website)
      `);

    console.log("Event added successfully:", result); // Debugging: Log the result
    res.status(201).send("Event added successfully.");
  } catch (error) {
    console.error("Error adding event:", error.message);
    res.status(500).send("Failed to add event.");
  }
});

app.delete('/api/events/:id', async (req, res) => {
  const eventId = req.params.id;

  try {
    const pool = await getConnection();
    console.log(`Attempting to delete event with ID: ${eventId}`); // Debug log

    const result = await pool.request()
      .input('id', sql.Int, eventId)
      .query('DELETE FROM Events WHERE id = @id');

    if (result.rowsAffected[0] === 0) {
      console.warn(`Event with ID ${eventId} not found.`); // Debug log
      return res.status(404).json({ error: 'Event not found.' });
    }

    console.log(`Event with ID ${eventId} deleted successfully.`); // Debug log
    res.status(200).send("Event deleted successfully.");
  } catch (error) {
    console.error('Error deleting event:', error.message); // Debug log
    res.status(500).send("Failed to delete event.");
  }
});

// Ensure upload folders exist
["uploads", "uploads/images", "uploads/videos"].forEach(async (folder) => {
  if (!fs.existsSync(folder)) await fs.promises.mkdir(folder, { recursive: true });
});


// Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadFolder = file.mimetype.startsWith("image/")
      ? "uploads/images"
      : "uploads/videos";
    cb(null, uploadFolder);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Unique filename
  },
});
const upload = multer({ storage });

app.get("/api/media", async (req, res) => {
  try {
    const pool = await getConnection();
    const result= await pool.request().query("SELECT * FROM Media ORDER BY UploadedAt DESC");
    res.status(200).json(result.recordset);
  } catch (err) {
    console.error("Error fetching media:", err.message);
    res.status(500).send("Error fetching media.");
  }
});

app.post("/api/media", upload.single("mediaFile"), async (req, res) => {
  // Debugging: Log the full request body
  console.log("Full Request Body:", req.body);

  const { MediaType, MediaTitle, UploadedBy, MediaPath } = req.body;

  // Debugging: Log the received MediaPath
  console.log("YouTube Embed Code Received:", MediaPath);

  let finalMediaPath = null;

  if (MediaType === "youtube") {
    if (!MediaPath || !MediaPath.trim()) {
      console.error("Validation failed: MediaPath is missing or empty.");
      return res.status(400).send("Error: No valid YouTube embed code provided.");
    }

    // Extract the src attribute from the iframe
    const iframeSrcMatch = MediaPath.match(/src="([^"]+)"/);
    if (!iframeSrcMatch) {
      console.error("Validation failed: Unable to extract src attribute from YouTube embed code.");
      return res.status(400).send("Error: Invalid YouTube embed code. Missing src attribute.");
    }

    const srcUrl = iframeSrcMatch[1];
    if (!srcUrl.startsWith("https://www.youtube.com/embed/")) {
      console.error("Validation failed: src attribute does not point to a valid YouTube embed URL.");
      return res.status(400).send("Error: Invalid YouTube embed URL in iframe.");
    }

    finalMediaPath = MediaPath.trim(); // Use the provided embed code
  } else if (req.file) {
    finalMediaPath = req.file.path.replace(/\\/g, "/"); // Use local file path for uploaded files
  } else {
    console.error("Validation failed: No valid media file uploaded.");
    return res.status(400).send("Error: No valid media file uploaded.");
  }

  try {
    const pool = await getConnection();
    const query = `
      INSERT INTO Media (MediaType, MediaTitle, MediaPath, UploadedBy)
      VALUES (@MediaType, @MediaTitle, @MediaPath, @UploadedBy);
    `;
    console.log("Inserting into database:", { MediaType, MediaTitle, finalMediaPath, UploadedBy });

    await pool.request()
      .input("MediaType", sql.NVarChar, MediaType)
      .input("MediaTitle", sql.NVarChar, MediaTitle)
      .input("MediaPath", sql.NVarChar, finalMediaPath)
      .input("UploadedBy", sql.NVarChar, UploadedBy)
      .query(query);

    console.log("Media uploaded successfully.");
    res.status(201).send("Media uploaded successfully.");
  } catch (err) {
    console.error("Error saving media to database:", err.message);
    res.status(500).send("Error saving media to database: " + err.message);
  }
});

app.delete('/api/media/:id', async (req, res) => {
  const mediaId = req.params.id;

  try {
      const pool = await getConnection();
      const result = await pool.request()
          .input('mediaId', sql.Int, mediaId)
          .query('SELECT MediaPath FROM Media WHERE MediaID = @mediaId');
      
      const mediaPath = result.recordset[0]?.MediaPath;
      if (mediaPath && fs.existsSync(mediaPath)) {
          fs.unlinkSync(mediaPath); // Delete the file
      }

      await pool.request()
          .input('mediaId', sql.Int, mediaId)
          .query('DELETE FROM Media WHERE MediaID = @mediaId');
      
      res.status(200).send("Media deleted successfully.");
  } catch (error) {
      console.error('Error deleting media:', error.message);
      res.status(500).send("Failed to delete media.");
  }
});


app.delete('/api/products/:id', async (req, res) => {
  const productId = req.params.id;

  try {
      const pool = await getConnection();
      await pool.request()
          .input('productId', sql.Int, productId)
          .query('DELETE FROM Products WHERE id = @productId');

      res.status(200).send("Product deleted successfully.");
  } catch (error) {
      console.error('Error deleting product:', error.message);
      res.status(500).send("Failed to delete product.");
  }
});

// Get images
app.get('/api/images', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .query(`
        SELECT MediaID AS id, 
               CONCAT('http://localhost:5000/', MediaPath) AS image_url, 
               MediaTitle AS description 
        FROM Media 
        WHERE MediaType = 'image' 
        ORDER BY UploadedAt DESC
      `);

    // Add additional validation or transformation if needed
    const images = result.recordset.map(image => ({
      ...image,
      isValid: image.image_url && image.description // Example validation
    }));

    res.json(images);
  } catch (error) {
    console.error('Error fetching images:', error.message);
    res.status(500).json({ error: 'Failed to fetch images' });
  }
});

// Get videos
app.get('/api/videos', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .query(`
        SELECT MediaID AS id, 
               MediaPath AS video_url, 
               MediaTitle AS title, 
               MediaType AS type 
        FROM Media 
        WHERE MediaType IN ('video', 'youtube') 
        ORDER BY UploadedAt DESC
      `);

    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching videos:', error.message);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

// API for managing categories
app.get('/api/categories', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request().query('SELECT CategoryID, Name FROM Categories');
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching categories:', error.message);
    res.status(500).send('Failed to fetch categories.');
  }
});

// Fix: Add category
app.post('/api/categories', async (req, res) => {
  const { name } = req.body;

  if (!name) {
    console.error('Category name is required.');
    return res.status(400).send('Category name is required.');
  }

  try {
    const pool = await getConnection();
    await pool.request()
      .input('name', sql.NVarChar, name)
      .query('INSERT INTO Categories (Name) VALUES (@name)');
    console.log(`Category "${name}" added successfully.`);
    res.status(201).send('Category added successfully.');
  } catch (error) {
    console.error('Error adding category:', error.message);
    res.status(500).send('Failed to add category.');
  }
});

app.post('/api/categories', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).send('Category name is required.');

  try {
    const pool = await getConnection();
    await pool.request()
      .input('name', sql.NVarChar, name)
      .query('INSERT INTO Categories (Name) VALUES (@name)');
    res.status(201).send('Category added successfully.');
  } catch (error) {
    console.error('Error adding category:', error.message);
    res.status(500).send('Failed to add category.');
  }
});

app.delete('/api/categories/:id', async (req, res) => {
  const categoryId = req.params.id;

  try {
    const pool = await getConnection();

    // Check for associated subcategories
    const subcategories = await pool.request()
      .input('categoryId', sql.Int, categoryId)
      .query('SELECT SubCategoryID FROM SubCategories WHERE CategoryID = @categoryId');

    if (subcategories.recordset.length > 0) {
      return res.status(400).json({ error: 'Category has associated subcategories. Delete them first.' });
    }

    // Delete the category
    await pool.request()
      .input('categoryId', sql.Int, categoryId)
      .query('DELETE FROM Categories WHERE CategoryID = @categoryId');

    res.status(200).send('Category deleted successfully.');
  } catch (error) {
    console.error('Error deleting category:', error.message);
    res.status(500).send('Failed to delete category.');
  }
});

// Update category
app.put('/api/categories/:id', async (req, res) => {
  const categoryId = req.params.id;
  const { name } = req.body;

  if (!name) return res.status(400).send('Category name is required.');

  try {
    const pool = await getConnection();
    await pool.request()
      .input('categoryId', sql.Int, categoryId)
      .input('name', sql.NVarChar, name)
      .query('UPDATE Categories SET Name = @name WHERE CategoryID = @categoryId');
    res.status(200).send('Category updated successfully.');
  } catch (error) {
    console.error('Error updating category:', error.message);
    res.status(500).send('Failed to update category.');
  }
});

// API for managing subcategories
app.get('/api/subcategories', async (req, res) => {
  const { categoryId } = req.query;

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('categoryId', sql.Int, categoryId || null)
      .query(`
        SELECT SubCategoryID, SubCategoryName, CategoryID 
        FROM SubCategories 
        WHERE @categoryId IS NULL OR CategoryID = @categoryId
      `);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching subcategories:', error.message);
    res.status(500).send('Failed to fetch subcategories.');
  }
});

// Fix: Add subcategory
app.post('/api/subcategories', async (req, res) => {
  const { name, categoryId } = req.body;

  if (!name || !categoryId) {
    console.error('Subcategory name and category ID are required.');
    return res.status(400).send('Subcategory name and category ID are required.');
  }

  try {
    const pool = await getConnection();
    await pool.request()
      .input('name', sql.NVarChar, name)
      .input('categoryId', sql.Int, categoryId)
      .query('INSERT INTO SubCategories (SubCategoryName, CategoryID) VALUES (@name, @categoryId)');
    console.log(`Subcategory "${name}" added successfully.`);
    res.status(201).send('Subcategory added successfully.');
  } catch (error) {
    console.error('Error adding subcategory:', error.message);
    res.status(500).send('Failed to add subcategory.');
  }
});

app.post('/api/subcategories', async (req, res) => {
  const { name, categoryId } = req.body;
  if (!name || !categoryId) return res.status(400).send('Subcategory name and category ID are required.');

  try {
    const pool = await getConnection();
    await pool.request()
      .input('name', sql.NVarChar, name)
      .input('categoryId', sql.Int, categoryId)
      .query('INSERT INTO SubCategories (SubCategoryName, CategoryID) VALUES (@name, @categoryId)');
    res.status(201).send('Subcategory added successfully.');
  } catch (error) {
    console.error('Error adding subcategory:', error.message);
    res.status(500).send('Failed to add subcategory.');
  }
});

app.delete('/api/subcategories/:id', async (req, res) => {
  const subcategoryId = req.params.id;

  try {
    const pool = await getConnection();

    // Check for associated descriptors
    const descriptors = await pool.request()
      .input('subcategoryId', sql.Int, subcategoryId)
      .query('SELECT DescriptorID FROM Descriptors WHERE SubCategoryID = @subcategoryId');

    if (descriptors.recordset.length > 0) {
      return res.status(400).json({ error: 'Subcategory has associated descriptors. Delete them first.' });
    }

    // Delete the subcategory
    await pool.request()
      .input('subcategoryId', sql.Int, subcategoryId)
      .query('DELETE FROM SubCategories WHERE SubCategoryID = @subcategoryId');

    res.status(200).send('Subcategory deleted successfully.');
  } catch (error) {
    console.error('Error deleting subcategory:', error.message);
    res.status(500).send('Failed to delete subcategory.');
  }
});

// Update subcategory
app.put('/api/subcategories/:id', async (req, res) => {
  const subcategoryId = req.params.id;
  const { name } = req.body;

  if (!name) return res.status(400).send('Subcategory name is required.');

  try {
    const pool = await getConnection();
    await pool.request()
      .input('subcategoryId', sql.Int, subcategoryId)
      .input('name', sql.NVarChar, name)
      .query('UPDATE SubCategories SET SubCategoryName = @name WHERE SubCategoryID = @subcategoryId');
    res.status(200).send('Subcategory updated successfully.');
  } catch (error) {
    console.error('Error updating subcategory:', error.message);
    res.status(500).send('Failed to update subcategory.');
  }
});

// API for managing descriptors
app.get('/api/descriptors', async (req, res) => {
  const { subCategoryId } = req.query;

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('subCategoryId', sql.Int, subCategoryId || null)
      .query(`
        SELECT DescriptorID, DescriptorName, SubCategoryID 
        FROM Descriptors 
        WHERE @subCategoryId IS NULL OR SubCategoryID = @subCategoryId
      `);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching descriptors:', error.message);
    res.status(500).send('Failed to fetch descriptors.');
  }
});

// Fix: Add descriptor
app.post('/api/descriptors', async (req, res) => {
  const { name, subCategoryId } = req.body;

  if (!name || !subCategoryId) {
    console.error('Descriptor name and subcategory ID are required.');
    return res.status(400).send('Descriptor name and subcategory ID are required.');
  }

  try {
    const pool = await getConnection();
    await pool.request()
      .input('name', sql.NVarChar, name)
      .input('subCategoryId', sql.Int, subCategoryId)
      .query('INSERT INTO Descriptors (DescriptorName, SubCategoryID) VALUES (@name, @subCategoryId)');
    console.log(`Descriptor "${name}" added successfully.`);
    res.status(201).send('Descriptor added successfully.');
  } catch (error) {
    console.error('Error adding descriptor:', error.message);
    res.status(500).send('Failed to add descriptor.');
  }
});

app.post('/api/descriptors', async (req, res) => {
  const { name, subCategoryId } = req.body;
  if (!name || !subCategoryId) return res.status(400).send('Descriptor name and subcategory ID are required.');

  try {
    const pool = await getConnection();
    await pool.request()
      .input('name', sql.NVarChar, name)
      .input('subCategoryId', sql.Int, subCategoryId)
      .query('INSERT INTO Descriptors (DescriptorName, SubCategoryID) VALUES (@name, @subCategoryId)');
    res.status(201).send('Descriptor added successfully.');
  } catch (error) {
    console.error('Error adding descriptor:', error.message);
    res.status(500).send('Failed to add descriptor.');
  }
});

app.delete('/api/descriptors/:id', async (req, res) => {
  const descriptorId = req.params.id;

  try {
    const pool = await getConnection();
    await pool.request()
      .input('descriptorId', sql.Int, descriptorId)
      .query('DELETE FROM Descriptors WHERE DescriptorID = @descriptorId');
    res.status(200).send('Descriptor deleted successfully.');
  } catch (error) {
    console.error('Error deleting descriptor:', error.message);
    res.status(500).send('Failed to delete descriptor.');
  }
});

// Update descriptor
app.put('/api/descriptors/:id', async (req, res) => {
  const descriptorId = req.params.id;
  const { name } = req.body;

  if (!name) return res.status(400).send('Descriptor name is required.');

  try {
    const pool = await getConnection();
    await pool.request()
      .input('descriptorId', sql.Int, descriptorId)
      .input('name', sql.NVarChar, name)
      .query('UPDATE Descriptors SET DescriptorName = @name WHERE DescriptorID = @descriptorId');
    res.status(200).send('Descriptor updated successfully.');
  } catch (error) {
    console.error('Error updating descriptor:', error.message);
    res.status(500).send('Failed to update descriptor.');
  }
});

// Fetch associated subcategories for a category
app.get('/api/categories/:id/subcategories', async (req, res) => {
  const categoryId = req.params.id;

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('categoryId', sql.Int, categoryId)
      .query('SELECT SubCategoryID, SubCategoryName FROM SubCategories WHERE CategoryID = @categoryId');
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching subcategories for category:', error.message);
    res.status(500).send('Failed to fetch subcategories.');
  }
});

// Fetch associated descriptors for a subcategory
app.get('/api/subcategories/:id/descriptors', async (req, res) => {
  const subcategoryId = req.params.id;

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('subcategoryId', sql.Int, subcategoryId)
      .query('SELECT DescriptorID, DescriptorName FROM Descriptors WHERE SubCategoryID = @subcategoryId');
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching descriptors for subcategory:', error.message);
    res.status(500).send('Failed to fetch descriptors.');
  }
});

// Signup endpoint
app.post("/api/signup", async (req, res) => {
  const { firstName, lastName, email, password, phone, address } = req.body;

  try {
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Save the user to the database
    const pool = await getConnection();
    await pool.request()
      .input("firstName", sql.NVarChar, firstName)
      .input("lastName", sql.NVarChar, lastName)
      .input("email", sql.NVarChar, email)
      .input("password", sql.NVarChar, hashedPassword)
      .input("phone", sql.NVarChar, phone)
      .input("address", sql.NVarChar, address)
      .query(`
        INSERT INTO users (first_name, last_name, email, password, phone, address)
        VALUES (@firstName, @lastName, @email, @password, @phone, @address)
      `);

    res.status(201).json({ message: "User created successfully!" });
  } catch (error) {
    console.error("Error during signup:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Login endpoint
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Fetch the user from the database
    const pool = await getConnection();
    const result = await pool.request()
      .input("email", sql.NVarChar, email)
      .query("SELECT * FROM users WHERE email = @email");

    const user = result.recordset[0];
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Compare the provided password with the hashed password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Generate a token with a longer expiration time (e.g., 7 days)
    const token = jwt.sign({ id: user.id, email: user.email }, SECRET_KEY, { expiresIn: "7d" });

    res.status(200).json({ token });
  } catch (error) {
    console.error("Error during login:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Endpoint to fetch user information
app.get("/api/user-info", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    console.error("Authorization header missing");
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    console.log("Decoded token:", decoded); // Debugging: Log the decoded token

    const pool = await getConnection();
    const result = await pool.request()
      .input("userId", sql.Int, decoded.id)
      .query("SELECT first_name, last_name, email, address FROM users WHERE id = @userId");

    if (result.recordset.length === 0) {
      console.error("User not found for ID:", decoded.id);
      return res.status(404).json({ message: "User not found" });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    console.error("Error fetching user info:", error.message); // Log the error message
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/api/refresh-token", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, SECRET_KEY, { ignoreExpiration: true }); // Ignore expiration for renewal
    const newToken = jwt.sign({ id: decoded.id, email: decoded.email }, SECRET_KEY, { expiresIn: "7d" });
    res.status(200).json({ token: newToken });
  } catch (error) {
    console.error("Error refreshing token:", error.message);
    res.status(500).json({ message: "Failed to refresh token" });
  }
});

// Validate token endpoint
app.post("/api/validate-token", (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: "Token is required" });
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    res.status(200).json({ valid: true, user: decoded });
  } catch (error) {
    res.status(401).json({ valid: false, error: "Invalid or expired token" });
  }
});

// Fix: New endpoint for fetching product details for the cart
app.get('/api/cart-products', async (req, res) => {
  const ids = req.query.ids?.split(",").map((id) => parseInt(id)).filter((id) => !isNaN(id));

  if (!ids || ids.length === 0) {
    return res.status(400).json({ error: "No valid product IDs provided." });
  }

  try {
    const pool = await getConnection();
    const request = pool.request();

    // Dynamically add inputs for each ID
    ids.forEach((id, i) => {
      request.input(`id${i}`, sql.Int, id);
    });

    const query = `
      SELECT id, name, price, image_url 
      FROM Products 
      WHERE id IN (${ids.map((_, i) => `@id${i}`).join(",")})
    `;

    const result = await request.query(query);
    res.json(result.recordset);
  } catch (error) {
    console.error("Error fetching cart products:", error.message);
    res.status(500).json({ error: "Failed to fetch cart products." });
  }
});

// Add a product to the cart
app.post('/api/cart', async (req, res) => {
  const { product_id, quantity } = req.body;
  const user_id = req.user?.id || null; // Use user_id if logged in
  const session_id = req.cookies.session_id; // Use session_id for guest users

  if (!product_id || !quantity) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  try {
    const pool = await getConnection();
    await pool.request()
      .input('user_id', sql.Int, user_id)
      .input('session_id', sql.NVarChar, session_id)
      .input('product_id', sql.Int, product_id)
      .input('quantity', sql.Int, quantity)
      .query(`
        MERGE Cart AS target
        USING (SELECT @user_id AS user_id, @session_id AS session_id, @product_id AS product_id) AS source
        ON (target.user_id = source.user_id OR target.session_id = source.session_id) AND target.product_id = source.product_id
        WHEN MATCHED THEN
          UPDATE SET quantity = quantity + @quantity, updated_at = GETDATE()
        WHEN NOT MATCHED THEN
          INSERT (user_id, session_id, product_id, quantity, created_at, updated_at)
          VALUES (@user_id, @session_id, @product_id, @quantity, GETDATE(), GETDATE());
      `);

    res.status(200).json({ message: "Product added to cart." });
  } catch (error) {
    console.error("Error adding product to cart:", error.message);
    res.status(500).json({ error: "Failed to add product to cart." });
  }
});

// Fetch cart items for a user or guest
app.get('/api/cart', async (req, res) => {
  const user_id = req.user?.id || null; // Use user_id if logged in
  const session_id = req.cookies.session_id; // Use session_id for guest users

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('user_id', sql.Int, user_id)
      .input('session_id', sql.NVarChar, session_id)
      .query(`
        SELECT c.id AS cart_id, c.quantity, p.id AS product_id, p.name, p.price, p.image_url
        FROM Cart c
        JOIN Products p ON c.product_id = p.id
        WHERE (c.user_id = @user_id OR c.session_id = @session_id)
      `);

    res.json(result.recordset);
  } catch (error) {
    console.error("Error fetching cart items:", error.message);
    res.status(500).json({ error: "Failed to fetch cart items." });
  }
});

// Remove a product from the cart
app.delete('/api/cart/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const user_id = req.user.id;

  try {
    const pool = await getConnection();
    await pool.request()
      .input('id', sql.Int, id)
      .input('user_id', sql.Int, user_id)
      .query(`
        DELETE FROM Cart
        WHERE id = @id AND user_id = @user_id
      `);

    res.status(200).json({ message: "Product removed from cart." });
  } catch (error) {
    console.error("Error removing product from cart:", error.message);
    res.status(500).json({ error: "Failed to remove product from cart." });
  }
});

app.post("/api/mastercard-checkout", authenticateToken, async (req, res) => {
  const { items, total, paymentIntentId } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Invalid or missing items in the order" });
  }

  if (!total || typeof total !== "number" || total <= 0) {
    return res.status(400).json({ error: "Invalid or missing total amount" });
  }

  if (!paymentIntentId || typeof paymentIntentId !== "string") {
    return res.status(400).json({ error: "Invalid or missing paymentIntentId" });
  }

  try {
    const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

    // Retrieve the payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    console.log("Payment Intent Status:", paymentIntent.status); // Log the payment intent status for debugging

    if (paymentIntent.status !== "succeeded") {
      return res.status(400).json({ error: "Payment not successful. Order not created." });
    }

    const pool = await getConnection();
    const userId = req.user.id;

    // Deduct inventory and check for insufficient stock
    const insufficientStock = await deductInventory(items);

    // Insert the order into the database
    const orderResult = await pool.request()
      .input("userId", sql.Int, userId)
      .input("totalAmount", sql.Decimal(18, 2), total)
      .input("status", sql.NVarChar, "Pending")
      .input("shippingStatus", sql.NVarChar, "Not Shipped")
      .query(`
        INSERT INTO orders (user_id, total_amount, status, shipping_status, created_at)
        OUTPUT INSERTED.id
        VALUES (@userId, @totalAmount, @status, @shippingStatus, GETDATE());
      `);

    const orderId = orderResult.recordset[0].id;

    // Insert order items into the order_items table
    for (const item of items) {
      await pool.request()
        .input("orderId", sql.Int, orderId)
        .input("productId", sql.Int, item.id)
        .input("quantity", sql.Int, item.quantity)
        .input("price", sql.Decimal(18, 2), item.price)
        .query(`
          INSERT INTO order_items (order_id, product_id, quantity, price)
          VALUES (@orderId, @productId, @quantity, @price);
        `);
    }

    // Fetch user email for sending the order confirmation
    const userResult = await pool.request()
      .input("userId", sql.Int, userId)
      .query("SELECT email FROM users WHERE id = @userId");

    const userEmail = userResult.recordset[0]?.email;

    if (userEmail) {
      // Send order confirmation email
      const orderDetails = items
        .map(
          (item) =>
            `<li>${item.name} - Quantity: ${item.quantity}, Price: $${item.price.toFixed(2)}</li>`
        )
        .join("");

      const emailContent = `
        <h1>Order Confirmation</h1>
        <p>Thank you for your order! Your order ID is <strong>${orderId}</strong>.</p>
        <p><strong>Order Details:</strong></p>
        <ul>${orderDetails}</ul>
        <p><strong>Total Amount:</strong> $${total.toFixed(2)}</p>
        <p>We will notify you once your order is shipped.</p>
      `;

      await sendEmail(
        userEmail,
        "Order Confirmation - Point FX BladeZ",
        emailContent
      );
    }

    res.status(200).json({
      message: insufficientStock
        ? "Order placed successfully. Note: Insufficient stock available. Shipping may be delayed."
        : "Order placed successfully.",
    });
  } catch (error) {
    console.error("Error processing order:", error.message);
    res.status(500).json({ error: "Failed to process order" });
  }
});

async function initiateMastercardPayment({ amount, currency, items, callbackUrl }) {
  try {
    const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

    // Ensure metadata is properly formatted
    const metadata = items.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
    }));

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency || "usd", // Default to USD if not provided
      metadata: { items: JSON.stringify(metadata).slice(0, 500) }, // Truncate metadata if necessary
      description: "Point FX BladeZ Order",
      receipt_email: "customer@example.com", // Replace with actual customer email
    });

    console.log("Stripe Payment Intent Response:", paymentIntent);

    if (!paymentIntent.client_secret) {
      throw new Error("Failed to generate clientSecret from Stripe");
    }

    return {
      redirectUrl: paymentIntent.next_action?.redirect_to_url?.url || "",
      clientSecret: paymentIntent.client_secret,
    };
  } catch (error) {
    console.error("Error in initiateMastercardPayment:", error.message);
    throw new Error("Failed to initiate Mastercard payment");
  }
}

// Update order status
app.put("/api/orders/:id/status", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { status, trackingNumber } = req.body;

  if (!status) {
    return res.status(400).json({ error: "Status is required" });
  }

  try {
    const pool = await getConnection();

    // Validate tracking number for "Shipped" status
    if (status === "Shipped" && !trackingNumber) {
      return res.status(400).json({ error: "Tracking number is required for shipped orders." });
    }

    // Update the order status and tracking number
    const result = await pool.request()
      .input("orderId", sql.Int, id)
      .input("status", sql.NVarChar, status)
      .input("trackingNumber", sql.NVarChar, trackingNumber || null)
      .query(`
        UPDATE Orders
        SET status = @status,
            tracking_number = @trackingNumber
        WHERE id = @orderId
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: "Order not found." });
    }

    // Log success and send response
    console.log(`Order ${id} status updated to ${status}`);
    res.status(200).json({ message: "Order status updated successfully" });
  } catch (error) {
    console.error("Error updating order status:", error.message);
    res.status(500).json({ error: "Failed to update order status" });
  }
});

// Update shipping status
app.put("/api/orders/:id/shipping", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { shippingStatus, trackingNumber, carrier } = req.body;

  if (!shippingStatus) {
    return res.status(400).json({ error: "Shipping status is required" });
  }

  try {
    const pool = await getConnection();
    await pool.request()
      .input("orderId", sql.Int, id)
      .input("shippingStatus", sql.NVarChar, shippingStatus)
      .input("trackingNumber", sql.NVarChar, trackingNumber || null)
      .input("carrier", sql.NVarChar, carrier || null)
      .query(`
        UPDATE Orders
        SET shipping_status = @shippingStatus,
            tracking_number = @trackingNumber,
            carrier = @carrier
        WHERE id = @orderId
      `);

    // Fetch order details for email
    const result = await pool.request()
      .input("orderId", sql.Int, id)
      .query(`
        SELECT o.id, o.total_amount, u.email
        FROM Orders o
        JOIN Users u ON o.user_id = u.id
        WHERE o.id = @orderId
      `);

    const order = result.recordset[0];
    if (order) {
      await sendEmail(
        order.email,
        `Order #${order.id} Shipping Update`,
        `<p>Your order shipping status has been updated to: <strong>${shippingStatus}</strong>.</p>
         <p>Tracking Number: ${trackingNumber || "N/A"}</p>
         <p>Carrier: ${carrier || "N/A"}</p>
         <p>Total Amount: $${order.total_amount.toFixed(2)}</p>`
      );
    }

    res.status(200).json({ message: "Shipping status updated successfully" });
  } catch (error) {
    console.error("Error updating shipping status:", error.message);
    res.status(500).json({ error: "Failed to update shipping status" });
  }
});

// Get shipping details
app.get("/api/orders/:id/shipping", authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input("orderId", sql.Int, id)
      .query(`
        SELECT shipping_status, tracking_number, carrier
        FROM Orders
        WHERE id = @orderId
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    console.error("Error fetching shipping details:", error.message);
    res.status(500).json({ error: "Failed to fetch shipping details" });
  }
});

// Fetch orders for the logged-in user
app.get("/orders", authenticateToken, async (req, res) => {
  const userId = req.user.id; // Extract user ID from the authenticated token

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input("userId", sql.Int, userId)
      .query(`
        SELECT 
          id, 
          total_amount, 
          status, 
          shipping_status, 
          tracking_number, 
          created_at 
        FROM Orders 
        WHERE user_id = @userId
        ORDER BY created_at DESC
      `);

    res.json(result.recordset);
  } catch (error) {
    console.error("Error fetching orders:", error.message);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

app.get("/api/admin/orders", authenticateToken, async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request().query(`
      SELECT 
        o.id, 
        o.total_amount, 
        o.status, 
        o.shipping_status, 
        o.created_at, 
        u.email AS user_email
      FROM Orders o
      JOIN Users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
    `);

    res.json(result.recordset); // Ensure this returns an array of orders
  } catch (error) {
    console.error("Error fetching admin orders:", error.message);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

app.get("/api/orders", authenticateToken, async (req, res) => {
  const { search = "", status = "" } = req.query;
  const userId = req.user.id; // Extract user ID from the authenticated token

  try {
    const pool = await getConnection();
    let query = `
      SELECT 
        id, 
        total_amount, 
        status, 
        shipping_status, 
        created_at 
      FROM Orders 
      WHERE user_id = @userId
    `;

    if (search) {
      query += ` AND (CAST(id AS NVARCHAR) LIKE '%' + @search + '%' OR CAST(user_id AS NVARCHAR) LIKE '%' + @search + '%')`;
    }

    if (status) {
      query += ` AND status = @status`;
    }

    query += ` ORDER BY created_at DESC`;

    const result = await pool.request()
      .input("userId", sql.Int, userId)
      .input("search", sql.NVarChar, search)
      .input("status", sql.NVarChar, status)
      .query(query);

    res.json(result.recordset);
  } catch (error) {
    console.error("Error fetching orders:", error.message);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// Endpoint to update inventory after a purchase
app.post("/api/update-inventory", authenticateToken, async (req, res) => {
  const { items } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: "No items provided for inventory update." });
  }

  try {
    const pool = await getConnection();
    const lowStockItems = [];

    for (const item of items) {
      const result = await pool.request()
        .input("productId", sql.Int, item.id)
        .query("SELECT stock_quantity, name, restock_threshold FROM Products WHERE id = @productId");

      const product = result.recordset[0];
      if (!product) {
        return res.status(404).json({ error: `Product with ID ${item.id} not found.` });
      }

      if (product.stock_quantity < item.quantity) {
        return res.status(400).json({ error: `Insufficient stock for product: ${product.name}` });
      }

      await pool.request()
        .input("productId", sql.Int, item.id)
        .input("quantity", sql.Int, item.quantity)
        .query("UPDATE Products SET stock_quantity = stock_quantity - @quantity WHERE id = @productId");

      if (product.stock_quantity - item.quantity <= product.restock_threshold) {
        lowStockItems.push({ id: item.id, name: product.name });
      }
    }

    res.status(200).json({ message: "Inventory updated successfully.", lowStockItems });
  } catch (error) {
    console.error("Error updating inventory:", error.message);
    res.status(500).json({ error: "Failed to update inventory." });
  }
});

// Endpoint to fetch low-stock products
app.get("/api/low-stock-products", authenticateToken, async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .query("SELECT id, name, stock_quantity, restock_threshold FROM Products WHERE stock_quantity <= restock_threshold");

    res.status(200).json(result.recordset);
  } catch (error) {
    console.error("Error fetching low-stock products:", error.message);
    res.status(500).json({ error: "Failed to fetch low-stock products." });
  }
});

// Endpoint to update product stock and restock threshold
app.patch("/api/products/:id/stock", async (req, res) => {
  const { id } = req.params;
  const { stockChange } = req.body;

  try {
    const pool = await getConnection();
    await pool.request()
      .input("productId", sql.Int, id)
      .input("stockChange", sql.Int, stockChange)
      .query("UPDATE Products SET stock_quantity = stock_quantity + @stockChange WHERE id = @productId");

    res.status(200).json({ message: "Stock updated successfully." });
  } catch (error) {
    console.error("Error updating stock:", error.message);
    res.status(500).json({ error: "Failed to update stock." });
  }
});

// Ensure the `restock_threshold` column exists in the database
app.post("/api/ensure-restock-threshold", async (req, res) => {
  try {
    const pool = await getConnection();
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT 1
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'Products' AND COLUMN_NAME = 'restock_threshold'
      )
      BEGIN
        ALTER TABLE Products ADD restock_threshold INT DEFAULT 2;
      END
    `);
    res.status(200).json({ message: "Restock threshold column ensured." });
  } catch (error) {
    console.error("Error ensuring restock_threshold column:", error.message);
    res.status(500).json({ error: "Failed to ensure restock_threshold column." });
  }
});

// Test email endpoint
app.get("/test-email", async (req, res) => {
  try {
    await sendEmail(
      process.env.EMAIL_USER,
      "Test Email",
      "This is a test email from Point FX BladeZ."
    );
    res.status(200).send("Test email sent successfully!");
  } catch (error) {
    console.error("Error sending test email:", error.message);
    res.status(500).send("Failed to send test email.");
  }
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

// Fix: Add missing error handling for Stripe API test endpoint
app.get("/test-stripe", async (req, res) => {
  try {
    const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: 1000, // $10.00 in cents
      currency: "usd",
      description: "Test Payment",
    });

    res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      message: "Stripe API is working correctly.",
    });
  } catch (error) {
    console.error("Error testing Stripe API:", error.message);
    res.status(500).json({ error: "Failed to test Stripe API" });
  }
});

app.post("/api/create-payment-intent", authenticateToken, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: "usd",
      description: "Point FX BladeZ Order",
    });

    res.status(200).json({
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret, // Include client_secret in the response
    });
  } catch (error) {
    console.error("Error creating payment intent:", error.message);
    res.status(500).json({ error: "Failed to create payment intent" });
  }
});

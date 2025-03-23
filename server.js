require("dotenv").config();
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

const SECRET_KEY = process.env.JWT_SECRET;

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(express.static(__dirname + "/public"));
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

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
                  id, name, description, price, image_url, stock_quantity, 
                  category_id, sub_category_id, tag_id, is_showcase 
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
    try {
        const pool = await getConnection();
        const query = `
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
            ORDER BY p.name ASC -- Order products by name in ascending order
        `;
        const result = await pool.request().query(query);
        res.json(result.recordset);
    } catch (error) {
        console.error("Error fetching products:", error.message);
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

// Get categories
app.get('/api/categories', async (req, res) => {
  try {
      const pool = await getConnection();
      const result = await pool.request().query('SELECT Categoryid, name FROM Categories');
      res.json(result.recordset);
  } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).send('Failed to fetch categories.');
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
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Access denied. Invalid token format.' });
  }

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
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

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

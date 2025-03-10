require("dotenv").config();
const express = require("express");
const cors = require("cors");
const sql = require("mssql");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const SECRET_KEY = process.env.JWT_SECRET;
// const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static(__dirname + "/public"));

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

// ✅ Debug: Log dbConfig before connecting
console.log("🔍 Checking dbConfig:", dbConfig);

// Establish a connection when the app starts
const pool = new sql.ConnectionPool(dbConfig);
pool.connect(err => {
  if (err) {
    console.error('❌ Database connection failed:', err);
  } else {
    console.log('✅ Database connected successfully');
  }
});

// Utility: Create SQL connection
async function getConnection() {
  return await sql.connect(dbConfig);
}

// Get all categories
app.get('/api/categories', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request().query('SELECT id, name FROM Categories');
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Get sub-categories by category ID
app.get('/api/subcategories', async (req, res) => {
  const { categoryId } = req.query;
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('categoryId', sql.Int, categoryId)
      .query('SELECT SubCategoryID AS id, SubCategoryName AS name FROM SubCategories WHERE CategoryID = @categoryId');
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching sub-categories:', error);
    res.status(500).json({ error: 'Failed to fetch sub-categories' });
  }
});

// Get descriptors by sub-category ID
app.get('/api/descriptors', async (req, res) => {
  const { subCategoryId } = req.query;
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('subCategoryId', sql.Int, subCategoryId)
      .query('SELECT DescriptorID AS id, DescriptorName AS name FROM Descriptors WHERE SubCategoryID = @subCategoryId');
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching descriptors:', error);
    res.status(500).json({ error: 'Failed to fetch descriptors' });
  }
});

// Get products by descriptor ID
app.get('/api/products', async (req, res) => {
  const { descriptorId } = req.query;
  if (!descriptorId || isNaN(descriptorId)) {
    return res.status(400).json({ error: 'Invalid descriptorId' });
  }
  console.log("Fetching products for descriptorId:", descriptorId); // Debugging line
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('descriptorId', sql.Int, descriptorId)
      .query('SELECT id, name, description, price, image_url FROM Products WHERE DescriptorID = @descriptorId');
    console.log("Products fetched:", result.recordset); // Debugging line
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Establish a connection when the app starts
async function connectDB() {
  try {
    await sql.connect(dbConfig);
    console.log("✅ Database connected successfully");
    await ensureAdminExists();
  } catch (err) {
    console.error("❌ Database connection failed:", err);
  }
}

// 🟢 Function to check and create an admin account
async function ensureAdminExists() {
  try {
    let pool = await sql.connect(dbConfig);
    let result = await pool
      .request()
      .query("SELECT COUNT(*) AS count FROM Admin");

    if (result.recordset[0].count === 0) {
      const hashedPassword = bcrypt.hashSync("Admin123!", 10); // Use sync for one-time ops
      await pool
        .request()
        .input("email", sql.NVarChar, "admin@live.com")
        .input("password", sql.NVarChar, hashedPassword)
        .query(
          "INSERT INTO Admin (email, password) VALUES (@email, @password)"
        );

      console.log(
        "✅ Admin account created: email - 'admin@live.com', Password - 'Admin123!'"
      );
    } else {
      console.log("🔹 Admin account already exists");
    }
  } catch (error) {
    console.error("❌ Error checking/creating admin:", error);
  }
}

// Call connectDB() at startup
connectDB();

module.exports = { getConnection };

// -----------------------
// User Registration (for non-admin users, if needed)
app.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    let pool = await getConnection();
    await pool
      .request()
      .input("email", sql.NVarChar, email)
      .input("password", sql.NVarChar, hashedPassword)
      .input("is_admin", sql.Bit, 0)
      .query(
        "INSERT INTO users (email, password, is_admin) VALUES (@email, @password, @is_admin)"
      );
    res.json({ message: "User registered successfully!" });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ error: err.message });
  }
});

// -----------------------
// Admin Registration Endpoint (Temporary - then remove)
app.post("/register-admin", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "Email and password are required." });
    }
    await pool
      .request()
      .input("email", sql.NVarChar, email)
      .input("password", sql.NVarChar, hashedPassword)
      .query("INSERT INTO Admin (email, password) VALUES (@email, @password)");
    res.json({ message: "Admin user created successfully!" });
  } catch (error) {
    console.error("Error creating admin user:", error);
    res.status(500).json({ error: error.message });
  }
});

// -----------------------
// Admin Login Route
const refreshTokens = []; // Store refresh tokens (in production, use a database)

app.post("/admin/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    let pool = await sql.connect(dbConfig);
    let result = await pool
      .request()
      .input("email", sql.NVarChar, email)
      .query("SELECT id, email, password FROM Admin WHERE email = @email");

    if (result.recordset.length === 0) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const admin = result.recordset[0];

    // 🛑 Check if password is valid before comparing
    if (!admin.password || typeof admin.password !== "string") {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    console.log("🔍 Debug: Entered Password:", password);
    console.log("🔍 Debug: Hashed Password from DB:", admin.password);

    // ✅ Fix: Use `bcrypt.compareSync` properly
    const passwordMatch = bcrypt.compareSync(password, admin.password.trim());

    if (!passwordMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign({ id: admin.id, email: admin.email }, SECRET_KEY, {
      expiresIn: "1h",
    });

    res.json({ message: "Login successful", token });
  } catch (error) {
    console.error("❌ Login error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/admin/refresh-token", (req, res) => {
  const refreshToken = req.cookies.refreshToken; // Get refresh token from cookie
  if (!refreshToken)
    return res.status(401).json({ message: "Refresh token required" });

  if (!refreshTokens.includes(refreshToken)) {
    return res.status(403).json({ message: "Invalid refresh token" });
  }

  // Verify refresh token
  jwt.verify(refreshToken, SECRET_KEY + "_refresh", (err, admin) => {
    if (err) return res.status(403).json({ message: "Invalid refresh token" });

    const newAccessToken = jwt.sign(
      { id: admin.id, email: admin.email },
      SECRET_KEY,
      { expiresIn: "15m" }
    );
    res.json({ accessToken: newAccessToken });
  });
});

app.post("/admin/logout", (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken)
    return res.status(400).json({ message: "No refresh token found" });

  const index = refreshTokens.indexOf(refreshToken);
  if (index > -1) refreshTokens.splice(index, 1); // Remove refresh token
  res.clearCookie("refreshToken");
  res.json({ message: "Logged out successfully" });
});

// -----------------------
// Login Endpoint
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    let pool = await getConnection();
    let result = await pool
      .request()
      .input("email", sql.NVarChar, email)
      .query("SELECT id, password, is_admin FROM users WHERE email = @email"); // Ensure password is selected

    if (result.recordset.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = result.recordset[0];

    if (!user.password) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, user.password.trim()); // Trim whitespace issues

    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user.id, is_admin: user.is_admin },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({ token });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: error.message });
  }
});

function authenticateAdmin(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(403).json({ error: "Access denied" });

  const token = authHeader.split(" ")[1];
  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });

    // Check if the user is an admin (for Admin table, no is_admin field)
    if (!user || !user.email) {
      return res.status(403).json({ error: "Admin access only" });
    }

    req.user = user;
    next();
  });
}

// -----------------------
// Middleware to verify JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.status(401).json({ message: "Token required" });

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err)
      return res.status(403).json({ message: "Invalid or expired token" });
    req.user = user; // Attach user info to request
    next();
  });
}

// -----------------------
// Endpoint to fetch products (for index page)
app.get("/products", async (req, res) => {
  try {
    let pool = await getConnection();
    let result = await pool
      .request()
      .query("SELECT id, name, description, price, image_url FROM products");
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: "Database error: " + err.message });
  }
});

// -----------------------
// Category Endpoints
app.get("/categories", async (req, res) => {
  try {
    let pool = await getConnection();
    let result = await pool.request().query("SELECT id, name FROM Categories");

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "No categories found" });
    }

    console.log("✅ Categories fetched:", result.recordset);
    res.json(result.recordset);
  } catch (err) {
    console.error("❌ Error fetching categories:", err);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

async function handleProductFormSubmit(e) {
  e.preventDefault();
  const token = localStorage.getItem("token");

  const id = document.getElementById("productId").value || null;
  const productData = {
    name: document.getElementById("productName").value,
    description: document.getElementById("productDescription").value,
    price: parseFloat(document.getElementById("productPrice").value) || 0,
    image_url: document.getElementById("productImage").value,
    stock_quantity:
      parseInt(document.getElementById("productStock").value) || 0,
    category_id:
      parseInt(document.getElementById("productCategory").value) || null,
    featured: document.getElementById("productFeatured").checked ? 1 : 0,
  };

  if (!productData.name || !productData.price || !productData.category_id) {
    alert("⚠️ Name, price, and category are required.");
    return;
  }

  console.log("Saving Product:", productData); // Debugging

  const method = id ? "PUT" : "POST";
  const url = id ? `/admin/products/${id}` : "/admin/products";

  try {
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify(productData),
    });

    const result = await res.json();
    console.log("Product Save Response:", result); // Debugging

    if (!res.ok) throw new Error(result.error || "Failed to save product");

    alert(result.message || "Product saved successfully!");
    e.target.reset();
    loadAdminProducts();
  } catch (error) {
    console.error("❌ Error saving product:", error);
    alert("Failed to save product. Please check the server.");
  }
}

// -----------------------
// Admin Product Endpoints (CRUD)
// Get all products (admin)
app.get("/admin/products", authenticateToken, async (req, res) => {
  try {
    let pool = await getConnection();
    let result = await pool.request().query(`
      SELECT p.id, p.name, p.description, p.price, p.image_url, p.stock_quantity, 
      c.name AS category_name 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id
    `);
    console.log("Fetched Products:", result.recordset); // Debug log
    res.json(result.recordset);
  } catch (err) {
    console.error("Error fetching products:", err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// Create a product (admin)
app.post("/admin/products", authenticateToken, async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      image_url,
      stock_quantity,
      category_id,
      featured,
    } = req.body;
    if (!name || !price || !category_id) {
      return res
        .status(400)
        .json({ error: "Name, price, and category are required." });
    }

    let pool = await getConnection();
    await pool
      .request()
      .input("name", sql.NVarChar, name)
      .input("description", sql.Text, description)
      .input("price", sql.Decimal(10, 2), price)
      .input("image_url", sql.NVarChar, image_url)
      .input("stock_quantity", sql.Int, stock_quantity)
      .input("category_id", sql.Int, category_id)
      .input("featured", sql.Bit, featured ? 1 : 0).query(`
        INSERT INTO products (name, description, price, image_url, stock_quantity, category_id, featured) 
        VALUES (@name, @description, @price, @image_url, @stock_quantity, @category_id, @featured)
      `);

    res.json({ message: "✅ Product added successfully!" });
  } catch (err) {
    console.error("❌ Error saving product:", err);
    res.status(500).json({ error: "Failed to save product." });
  }
});

// Get a single product by ID (for editing)
app.get("/admin/products/:id", authenticateToken, async (req, res) => {
  try {
    const id = req.params.id;
    let pool = await getConnection();
    let result = await pool
      .request()
      .input("id", sql.Int, id)
      .query("SELECT * FROM products WHERE id = @id");
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(result.recordset[0]); // Send the product data
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a product (admin)
app.put("/admin/products/:id", authenticateToken, async (req, res) => {
  try {
    const { name, description, price, image_url, stock_quantity, category_id } =
      req.body;
    const id = req.params.id;
    let pool = await getConnection();
    await pool
      .request()
      .input("id", sql.Int, id)
      .input("name", sql.NVarChar, name)
      .input("description", sql.Text, description)
      .input("price", sql.Decimal(10, 2), price)
      .input("image_url", sql.NVarChar, image_url)
      .input("stock_quantity", sql.Int, stock_quantity)
      .input("category_id", sql.Int, category_id)
      .query(
        "UPDATE products SET name = @name, description = @description, price = @price, image_url = @image_url, stock_quantity = @stock_quantity, category_id = @category_id WHERE id = @id"
      );
    res.json({ message: "Product updated successfully!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a product (admin)
app.delete("/admin/products/:id", authenticateToken, async (req, res) => {
  try {
    const id = req.params.id;
    let pool = await getConnection();
    let result = await pool
      .request()
      .input("id", sql.Int, id)
      .query("DELETE FROM products WHERE id = @id");
    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json({ message: "Product deleted successfully!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------
// Orders Endpoints

// Place Order (after payment)
app.post("/place-order", authenticateToken, async (req, res) => {
  try {
    const { cart, total_amount } = req.body;
    const user_id = req.user.id;
    let pool = await getConnection();
    let orderResult = await pool
      .request()
      .input("user_id", sql.Int, user_id)
      .input("total_amount", sql.Decimal(10, 2), total_amount)
      .query(
        "INSERT INTO orders (user_id, total_amount) OUTPUT INSERTED.id VALUES (@user_id, @total_amount)"
      );
    const orderId = orderResult.recordset[0].id;
    for (let item of cart) {
      await pool
        .request()
        .input("order_id", sql.Int, orderId)
        .input("product_id", sql.Int, item.id)
        .input("quantity", sql.Int, item.quantity)
        .input("price", sql.Decimal(10, 2), item.price)
        .query(
          "INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (@order_id, @product_id, @quantity, @price)"
        );
    }
    res.json({ message: "Order placed successfully!", orderId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get orders for logged-in user
app.get("/orders", authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id;
    let pool = await getConnection();
    let result = await pool
      .request()
      .input("user_id", sql.Int, user_id)
      .query(
        "SELECT * FROM orders WHERE user_id = @user_id ORDER BY created_at DESC"
      );
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------
// Shipping Update (admin)
app.post("/update-shipping", authenticateToken, async (req, res) => {
  try {
    const { order_id, shipping_status } = req.body;
    let pool = await getConnection();
    await pool
      .request()
      .input("order_id", sql.Int, order_id)
      .input("shipping_status", sql.NVarChar, shipping_status)
      .query(
        "UPDATE orders SET shipping_status = @shipping_status WHERE id = @order_id"
      );
    res.json({ message: "Shipping status updated successfully!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API route to get products
app.get("/api/products", async (req, res) => {
  try {
    let pool = await sql.connect(dbConfig);
    let result = await pool
      .request()
      .query("SELECT id, name, description, price, image_url FROM Products");
    res.json(result.recordset);
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// Fetch all events
app.get("/admin/events", authenticateToken, async (req, res) => {
  try {
    let pool = await getConnection();
    let result = await pool
      .request()
      .query("SELECT * FROM events ORDER BY event_start_date ASC");
    res.json(result.recordset);
  } catch (err) {
    console.error("Error fetching events:", err);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

// Add a new event
app.post("/admin/events", authenticateToken, async (req, res) => {
  try {
    const {
      title,
      description,
      event_start_date,
      event_end_date,
      event_website,
      location,
    } = req.body;
    let pool = await getConnection();
    await pool
      .request()
      .input("title", sql.NVarChar, title)
      .input("description", sql.Text, description)
      .input("event_start_date", sql.DateTime, event_start_date)
      .input("event_end_date", sql.DateTime, event_end_date)
      .input("event_website", sql.NVarChar, event_website)
      .input("location", sql.NVarChar, location)
      .query(`INSERT INTO events (title, description, event_start_date, event_end_date, event_website, location) 
              VALUES (@title, @description, @event_start_date, @event_end_date, @event_website, @location)`);
    res.json({ message: "Event added successfully!" });
  } catch (err) {
    console.error("Error adding event:", err);
    res.status(500).json({ error: "Failed to add event" });
  }
});

// Update an existing event
app.put("/admin/events/:id", authenticateToken, async (req, res) => {
  try {
    const {
      title,
      description,
      event_start_date,
      event_end_date,
      event_website,
      location,
    } = req.body;
    const id = req.params.id;
    let pool = await getConnection();
    await pool
      .request()
      .input("id", sql.Int, id)
      .input("title", sql.NVarChar, title)
      .input("description", sql.Text, description)
      .input("event_start_date", sql.DateTime, event_start_date)
      .input("event_end_date", sql.DateTime, event_end_date)
      .input("event_website", sql.NVarChar, event_website)
      .input("location", sql.NVarChar, location)
      .query(`UPDATE events SET title = @title, description = @description, event_start_date = @event_start_date, 
              event_end_date = @event_end_date, event_website = @event_website, location = @location 
              WHERE id = @id`);
    res.json({ message: "Event updated successfully!" });
  } catch (err) {
    console.error("Error updating event:", err);
    res.status(500).json({ error: "Failed to update event" });
  }
});

// Delete an event
app.delete("/admin/events/:id", authenticateToken, async (req, res) => {
  try {
    const id = req.params.id;
    let pool = await getConnection();
    await pool
      .request()
      .input("id", sql.Int, id)
      .query("DELETE FROM events WHERE id = @id");
    res.json({ message: "Event deleted successfully!" });
  } catch (err) {
    console.error("Error deleting event:", err);
    res.status(500).json({ error: "Failed to delete event" });
  }
});

// API route to get public events
app.get("/api/events", async (req, res) => {
  try {
    let pool = await sql.connect(dbConfig);
    let result = await pool
      .request()
      .query(
        "SELECT title, description, event_start_date, event_end_date, event_website, location FROM events ORDER BY event_start_date ASC"
      );
    res.json(result.recordset);
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});


// -----------------------
// Stripe Payment Intent Endpoint
// app.post("/create-payment-intent", authenticateToken, async (req, res) => {
//   try {
//     const { cart } = req.body;
//     const totalAmount = cart.reduce(
//       (sum, item) => sum + item.price * item.quantity,
//       0
//     );
//     const paymentIntent = await stripe.paymentIntents.create({
//       amount: Math.round(totalAmount * 100), // convert dollars to cents
//       currency: "usd",
//     });
//     res.json({ clientSecret: paymentIntent.client_secret });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

app.listen(PORT, () => {
  console.log('Server running on http://localhost:${PORT}');
});

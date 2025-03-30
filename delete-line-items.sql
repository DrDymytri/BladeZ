-- Delete related records in the order_items table first
DELETE FROM order_items
WHERE order_id = @OrderId;

-- Then delete the record in the orders table
DELETE FROM orders
WHERE id = @OrderId;

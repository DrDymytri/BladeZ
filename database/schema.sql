ALTER TABLE Products
ADD SubCategoryID INT;

ALTER TABLE Products
ADD CONSTRAINT FK_Products_SubCategories
FOREIGN KEY (SubCategoryID) REFERENCES SubCategories(SubCategoryID);

-- Example: Update existing products to set a default SubCategoryID (assuming 1 is a valid SubCategoryID)
UPDATE Products
SET SubCategoryID = 1
WHERE SubCategoryID IS NULL;

-- Example: Check for invalid SubCategoryID values
SELECT *
FROM Products
WHERE SubCategoryID NOT IN (SELECT SubCategoryID FROM SubCategories);

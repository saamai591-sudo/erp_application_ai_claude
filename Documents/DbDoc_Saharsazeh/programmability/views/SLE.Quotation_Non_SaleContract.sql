

CREATE   VIEW [SLE].Quotation_Non_SaleContract
AS
    SELECT qi.QuotationItemID ,
    q.QuotationID,
           q.CurrencyID ,
           q.SaleAreaID,
           q.BranchID,
           q.SaleTypeID,
           q.[Date],
           q.CustomerID,
           qi.MainQuantity ,
           qi.SubQuantity ,
           qi.Fee ,
           sc.SaleContractMainQuantity DoMainQuantity ,
           sc.SaleContractSubQuantity DoSubQuantity ,
           qi.MainQuantity - ISNULL(SaleContractMainQuantity,0)  AS Non ,
           qi.SubQuantity - ISNULL(SaleContractSubQuantity,0) SubNon ,
           qi.Price ,
           qi.Discount ,
           qi.StuffID,
           qi.Price - ISNULL(sc.SaleContractPrice,0) AS NonPrice ,
           qi.Discount - ISNULL(sc.SaleContractDiscount ,0) NonDiscount,
           q.[Status]
    FROM   sle.QuotationItem AS qi
    join sle.Quotation AS q on q.QuotationID = qi.QuotationID
    left join (
    	SELECT sci.QuotationItemID,SUM(sci.MainQuantity) SaleContractMainQuantity,SUM(sci.SubQuantity) SaleContractSubQuantity,
    	SUM(sci.Price) SaleContractPrice,SUM(sci.Discount) SaleContractDiscount
    	
    	 FROM sle.SaleContractItem AS sci
    	WHERE sci.QuotationItemID is NOT NULL
    	GROUP BY sci.QuotationItemID) sc on qi.QuotationItemID = sc.QuotationItemID;
    	

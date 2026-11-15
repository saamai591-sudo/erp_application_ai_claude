
-------------------------------------[SLE].[spQuotationReport_DestinationDetail]----------------------------------
CREATE     PROC [SLE].[spQuotationReport_DestinationDetail]
(@QuotationItemID INT, @DestinationEntity NVARCHAR(MAX)) 
as 

DECLARE @DateType       TINYINT,
        @DateFormat     VARCHAR(10),
        @Culture        VARCHAR(10),
        @CultureNo      TINYINT = 0,
        @UserID         INT
      
SET @Culture = CFG.GetuserCulture();

SELECT @CultureNo = CultureNo
FROM   CFG.CultureInfo
WHERE  Culture = @Culture;


SET @UserID = cfg.GetuserID()

SELECT @DateType = us.SettingValue
FROM   CFG.UserSetting us
WHERE  us.SettingKey = 'Date_Type'
       AND us.UserID = @UserID;

IF @DateType IS NULL
    SET @DateType = CASE @Culture
                         WHEN 'fa' THEN 0
                         WHEN 'en' THEN 1
                         WHEN 'ar' THEN 2
                    END;

SELECT @DateFormat = us.SettingValue
FROM   CFG.UserSetting us
WHERE  us.SettingKey = 'Date_Format'
       AND us.UserID = @UserID;

IF @DateFormat IS NULL
    SET @DateFormat = 'YY/MM/DD';
 
 ----Outgoing

IF @DestinationEntity = 'Outgoing'
BEGIN
    SELECT qo.OutgoingID,
           qo.OutgoingItemID
    INTO   #Src
    FROM   sle.Quotation_Outgoing AS qo
    WHERE  qo.QuotationItemID = @QuotationItemID
    GROUP BY
           qo.OutgoingID,qo.OutgoingItemID
    
    SELECT 'Outgoing'                Document,
           o.OutgoingID              DocumentID,
           o.Number,
           cfg.GetCLRSaturnDate(o.[Date], @DateFormat, @DateType, 0) OutgoingDate,
           oi.MainQuantity
    FROM   stc.Outgoing           AS o
           JOIN #Src              AS s
                ON  s.OutgoingID = o.OutgoingID
           JOIN stc.OutgoingItem  AS oi
                ON  s.OutgoingItemID = oi.OutgoingItemID
END
----Remittance
IF @DestinationEntity = 'Remittance'
BEGIN
    SELECT qr.RemittanceItemID
    INTO   #RemittanceSrc
    FROM   sle.Quotation_Remittance AS qr
    WHERE  qr.QuotationItemID = @QuotationItemID
    GROUP BY
           qr.RemittanceItemID
    
    SELECT 'Remittance'                Document,
           r.RemittanceID              DocumentID,
           r.Number,
           cfg.GetCLRSaturnDate(r.[Date], @DateFormat, @DateType, 0) OutgoingDate,
           ri.MainQuantity
    FROM   sle.RemittanceItem            AS ri
           JOIN #RemittanceSrc              AS s
                ON  s.RemittanceItemID = ri.RemittanceItemID
           join sle.Remittance AS r on r.RemittanceID = ri.RemittanceID
END

---SaleContract

IF @DestinationEntity = 'SaleContract'
BEGIN
    SELECT qr.SaleContractItemID
    INTO   #SaleContractSrc
    FROM   sle.SaleContractItem  AS qr
    WHERE  qr.QuotationItemID = @QuotationItemID
    GROUP BY
           qr.SaleContractItemID
    
    SELECT 'SaleContract'                Document,
           r.SaleContractID              DocumentID,
           r.Number,
           cfg.GetCLRSaturnDate(r.[Date], @DateFormat, @DateType, 0) OutgoingDate,
           ri.MainQuantity,
           ri.Price,
		   ri.Fee,
           ri.Discount
    FROM   sle.SaleContractItem            AS ri
           JOIN #SaleContractSrc              AS s
                ON  s.SaleContractItemID = ri.SaleContractItemID
           join sle.SaleContract AS r on r.SaleContractID = ri.SaleContractID
END

--Invoice

IF @DestinationEntity = 'Invoice'
BEGIN
    SELECT qr.InvoiceItemID
    INTO   #InvoiceSrc
    FROM   sle.Quotation_Invoice   AS qr
    WHERE  qr.QuotationItemID = @QuotationItemID
    GROUP BY
           qr.InvoiceItemID
    
    SELECT 'Invoice'                Document,
           r.InvoiceID              DocumentID,
           r.Number,
           cfg.GetCLRSaturnDate(r.[Date], @DateFormat, @DateType, 0) OutgoingDate,
           ri.MainQuantity,
           ri.Price,
		   ri.Fee,
           ri.Discount
    FROM   sle.InvoiceItem            AS ri
           JOIN #InvoiceSrc              AS s
                ON  s.InvoiceItemID = ri.InvoiceItemID
           join sle.Invoice AS r on r.InvoiceID = ri.InvoiceID
END


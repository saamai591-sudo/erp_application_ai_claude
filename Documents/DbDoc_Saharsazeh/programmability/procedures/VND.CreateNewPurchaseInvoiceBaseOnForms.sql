-------------------------------------
CREATE   PROCEDURE [VND].CreateNewPurchaseInvoiceBaseOnForms
(
    @entityId INT,
    @engName NVARCHAR(255)
)
--WITH ENCRYPTION
AS
BEGIN
    DECLARE @PrecisionCount INT,
            @currencyId INT = -1,
            @CultureNo TINYINT;
    SELECT @CultureNo = CultureNo
    FROM CFG.CultureInfo
    WHERE Culture = CFG.GetuserCulture();
    SELECT @PrecisionCount = c.PrecisionCount
    FROM CFG.Currency AS c
    WHERE c.CurrencyID = @currencyId;
    IF @engName = 'PurchaseContract'
	BEGIN
		    SELECT @PrecisionCount = c.PrecisionCount
			FROM VND.PurchaseContract AS pc
			    JOIN CFG.Currency AS c
			        ON c.CurrencyID = pc.CurrencyID
			WHERE pc.PurchaseContractID = @entityId;
			SELECT ROW_NUMBER() OVER (ORDER BY pci.RowIndex) AS RowIndex,
			       pci.PurchaseContractItemID,
			       pc.Number AS PurchaseContractItemNumber,
			       pci.Fee,
			       pci.Discount,
			       pci.Tax,
			       pci.Duty,
			       pcr.Non AS MainQuantity,
			       pcr.NonSub AS SubQuantity,
			       sd.IranCode,
			       sd.Barcode AS BarCode,
			       pci.StuffID,
			       CASE @CultureNo
			           WHEN 1 THEN
			               s.Title
			           WHEN 2 THEN
			               s.Title2
			       END AS StuffTitle,
			       s.Code AS StuffCode,
			       CASE @CultureNo
			           WHEN 1 THEN
			               mu.Title
			           WHEN 2 THEN
			               mu.Title2
			       END AS MainUnit,
			       ROUND(pci.Fee * pcr.Non, @PrecisionCount) AS Price,
			       pci.Price - pci.Discount + pci.Tax + pci.Duty AS NetPrice
			INTO #PurchaseContractItems
			FROM VND.PurchaseContractItem AS pci
			    JOIN VND.PurchaseContract AS pc
			        ON pci.PurchaseContractID = pc.PurchaseContractID
			    JOIN [VND].[PurchaseContract_Remains] AS pcr
			        ON pci.PurchaseContractItemID = pcr.PurchaseContractItemID
			    JOIN STF.[Stuff] AS s
			        ON s.StuffID = pci.StuffID
			    JOIN STF.StuffDetail AS sd
			        ON sd.StuffID = s.StuffID
			    JOIN STF.MeasureUnit AS mu
			        ON mu.MeasureUnitID = s.MainMeasureUnitID
			WHERE pcr.Non > 0
			      AND pc.PurchaseContractID = @entityId
			     
		    --header
			SELECT pc.FinancialPeriodID,
			       -1 AS PurchaseInvoiceID,
			       CAST(8 AS TINYINT) AS BaseType,
			       pc.[Date],
				   pc.Number,
			       pc.BranchID,
			       pc.DlID,		   
				   d.Code AS VendorCode,
				   CASE @CultureNo
			           WHEN 1 THEN
			               d.Title
			           WHEN 2 THEN
			               d.Title2
			       END AS VendorTitle,				   
			       pc.CurrencyID,
			       CAST(1 AS DECIMAL(30, 4)) CurrencyRate,
			       pc.TotalPrice,
			       pc.TotalDiscount,
			       pc.TotalNetPrice,
			       pc.TotalTax,
			       pc.TotalDuty,
			       pc.[Type],
			       CAST(1 AS BIT) IsNotInFlow,
			       GETDATE() CreationDate
			FROM VND.PurchaseContract AS pc			
			JOIN acc.dl d ON pc.Dlid = d.DlID
			WHERE pc.PurchaseContractID = @entityId;
			-- items
			SELECT CAST(-1 * t.RowIndex AS INT) AS PurchaseInvoiceItemID,
				   -1 AS PurchaseInvoiceID,
			       CAST(t.RowIndex AS TINYINT) RowIndex,
			       t.PurchaseContractItemID,
				   t.PurchaseContractItemNumber,
			       t.Fee,
			       t.Discount,
			       t.Tax,
			       t.Duty,
			       t.MainQuantity,
			       t.SubQuantity,
			       t.IranCode,
			       t.BarCode,
			       t.StuffID,
			       t.StuffTitle,
			       t.StuffCode,
			       t.MainUnit,
			       t.Price
			FROM #PurchaseContractItems AS t;
	END
END;

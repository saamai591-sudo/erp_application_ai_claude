
CREATE    PROC [VND].[spPurchaseContractReview_Stuff]
(	@FromDate date,
	@ToDate date,
	@SelectedBranch				nvarchar(MAX) = Null,
	@SelectedPurchaseType		nvarchar(MAX) = Null,
	@SelectedVendor				nvarchar(MAX) = Null)

AS 
	DECLARE @TableName Nvarchar(MAX),
			@Query nvarchar(MAX),
			@Culture nvarchar(10),
			@CultureNo tinyint,
			@StuffType NVARCHAR(MAX)

	set @TableName = cfg.getTempTableName(1)
    SET @Culture = CFG.GetuserCulture();
	
    SELECT @CultureNo = CultureNo
    FROM CFG.CultureInfo
    WHERE Culture = @Culture;
	
	SELECT @StuffType = LE.Value FROM CFG.LocalizeEnum L 
		INNER JOIN CFG.LocalizeEnumValue LE 
			ON L.LocalizeEnumID = LE.LocalizeEnumID
	WHERE L.Enum = 'StuffType'
		AND L.Item = 'SERVICE' 
		AND LE.Culture = @Culture

	exec vnd.spPurchaseContractReviewDataSource
		@FromDate =	@FromDate,
		@ToDate =		@ToDate,
		@TableName =	@TableName,
		@SelectedBranch			= @SelectedBranch,	 
		@SelectedPurchaseType	= @SelectedPurchaseType,	
		@SelectedVendor		= @SelectedVendor	
	 
	 create table #Source
	 (
		StuffID				INT,
		StuffType               NVARCHAR(MAX),
		CurrencyID				INT,
		PurchaseContractQuantity		DECIMAL(36,10),
		PurchaseContractSubQuantity		DECIMAL(36,10),
		TemporaryStockReceiptQuantity  DECIMAL(36,10),
		JustificationInputQuantity     DECIMAL(36,10),
		StockReceiptQuantity           DECIMAL(36,10),
		PurchaseInvoiceQuantity        DECIMAL(36,10),
		PurchaseContractPrice			DECIMAL(36,10),
		PurchaseContractDuty			DECIMAL(36,10),
		PurchaseContractDiscount		DECIMAL(36,10),
		PurchaseContractNetPrice		DECIMAL(36,10)
	 )
	 
	SET @Query = N' 
    INSERT INTO #Source
    SELECT pci.StuffID,
           case 
           when s.Type = 0 then @StuffType
		   when s.Type = 1 then @StuffType END AS StuffType,
           pc.CurrencyID,
           SUM(pci.MainQuantity) AS PurchaseContractQuantity,
           SUM(pci.SubQuantity) AS PurchaseContractSubQuantity,
           SUM(TemporaryStockReceiptQuantity) AS TemporaryStockReceiptQuantity,
           SUM(JustificationInputQuantity) AS JustificationInputQuantity,
           SUM(StockReceiptQuantity) AS StockReceiptQuantity,
           SUM(PurchaseInvoiceQuantity) AS PurchaseInvoiceQuantity,
           SUM(pci.Price) AS PurchaseContractPrice,
           SUM(pci.Tax + pci.Duty) AS PurchaseContractDuty,
           SUM(pci.Discount) AS PurchaseContractDiscount,
           SUM(pci.Net) AS PurchaseContractNetPrice
    FROM vnd.PurchaseContractItem pci 
    JOIN ' + @TableName + N' a ON a.PurchaseContractItemID = pci.PurchaseContractItemID
    JOIN vnd.PurchaseContract pc ON pci.PurchaseContractID = pc.PurchaseContractID
		   join STF.Stuff s on pci.StuffID = s.StuffID
    GROUP BY pci.StuffID, pc.CurrencyID,s.StuffID,s.Type';

	exec sp_executesql @Query, N'@StuffType nvarchar(100)'  , @StuffType = @StuffType 

	select * into #vwStuff
	from stf.VWStuff

	select s.Code,
		s.TechnicalCode PurchaseContractTechnicalCode,
		s.SubMeasureUnit PurchaseContractSubMeasureUnit,
		case when @CultureNo = 1 then s.Title else s.Title2 end StuffTitle,
		case when @CultureNo = 1 then c.Title else c.Title2 end CurrencyTitle,
		case when @CultureNo = 1 then s.MainMeasureUnit else s.MainMeasureUnit2 end MainMeasureUnit ,
		src.*	  
	from #Source src
	join #vwStuff s on src.StuffID = s.StuffID
	join cfg.Currency c on src.CurrencyID = c.CurrencyID

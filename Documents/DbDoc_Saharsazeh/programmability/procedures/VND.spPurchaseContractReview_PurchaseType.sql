CREATE    proc [VND].[spPurchaseContractReview_PurchaseType]
(	@FromDate date,
	@ToDate date,
	@SelectedBranch				nvarchar(MAX) = Null,
	@SelectedStuff		nvarchar(MAX) = Null,
	@SelectedVendor				nvarchar(MAX) = Null)

	as 
	
	declare @TableName Nvarchar(MAX),
			@Query nvarchar(MAX),
			@Culture nvarchar(10),
			@CultureNo tinyint
	
	set @TableName = cfg.getTempTableName(1)

	
    SET @Culture = CFG.GetuserCulture();
	
    SELECT @CultureNo = CultureNo
    FROM CFG.CultureInfo
    WHERE Culture = @Culture;
	
	exec vnd.spPurchaseContractReviewDataSource
	@FromDate =	@FromDate,
	 @ToDate =		@ToDate,
	 @TableName =	@TableName,
	 @SelectedBranch			= @SelectedBranch,	 
	 @SelectedStuff				= @SelectedStuff,	
	 @SelectedVendor			= @SelectedVendor	
	 
	 create table #Source
	 (PurchaseTypeID				int,
	 CurrencyID				int,
	 PurchaseContractQuantity		Decimal(36,10),
	 TemporaryStockReceiptQuantity  Decimal(36,10),
	 JustificationInputQuantity     Decimal(36,10),
	 StockReceiptQuantity           Decimal(36,10),
	 PurchaseInvoiceQuantity        Decimal(36,10),
	 PurchaseContractPrice			Decimal(36,10),
	 PurchaseContractDuty			Decimal(36,10),
	 PurchaseContractDiscount		Decimal(36,10),
	 PurchaseContractNetPrice		Decimal(36,10))
	 
	 set	 @Query = N' 
	 insert into #Source
	 select pc.Type PurchaseTypeID,
			pc.CurrencyID,
			sum(pci.MainQuantity)				 PurchaseContractQuantity,
			sum(TemporaryStockReceiptQuantity) TemporaryStockReceiptQuantity,
			sum(JustificationInputQuantity)	 JustificationInputQuantity,
			sum(StockReceiptQuantity)			 StockReceiptQuantity,
			sum(PurchaseInvoiceQuantity)		 PurchaseInvoiceQuantity,
			sum(pci.Price)					 PurchaseContractPrice,
			sum(pci.Tax+pci.Duty)              PurchaseContractDuty,
			sum(pci.Discount)                  PurchaseContractDiscount,
			sum(pci.Net)						 PurchaseContractNetPrice
	  from  vnd.PurchaseContractItem  pci join '+@TableName + N' a
	     on a.PurchaseContractItemID = pci.PurchaseContractItemID
	  join vnd.purchaseContract pc on pci.PurchaseContractID = pc.PurchaseContractID
	 
	  group by pc.Type,pc.CurrencyID'

	  exec (@Query)


	  select pt.Code,
	  case when @CultureNo = 1 then pt.Title else pt.Title2 end PurchaseTypeTitle,
	  case when @CultureNo = 1 then c.Title else c.Title2 end CurrencyTitle,

	  src.*	  
	  from #Source src
	  join vnd.PurchaseType pt on pt.PurchaseTypeID = src.PurchaseTypeID
	  join cfg.Currency c on src.CurrencyID = c.CurrencyID

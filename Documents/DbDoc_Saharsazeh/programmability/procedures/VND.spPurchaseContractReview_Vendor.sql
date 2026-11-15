
CREATE   proc VND.spPurchaseContractReview_Vendor
(	@FromDate date,
	@ToDate date,
	@SelectedBranch				nvarchar(MAX) = Null,
	@SelectedStuff				nvarchar(MAX) = Null,
	@SelectedPurchaseType		nvarchar(MAX) = Null)

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
	 @FromDate					= @FromDate,
	 @ToDate					= @ToDate,
	 @TableName					= @TableName,
	 @SelectedBranch			= @SelectedBranch,	 
	 @SelectedStuff				= @SelectedStuff,	
	 @SelectedPurchaseType		= @SelectedPurchaseType	

	 create table #Source
	 (DlID							int,
	 CurrencyID						int,
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
	 select pc.DlID,
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
	  JOIN STF.VWStuff s ON pci.StuffID = s.StuffID  
	  group by pc.DlID,pc.CurrencyID'

	  exec (@Query)
	  
	 
	  select d.Code,
	  case when @CultureNo = 1 then d.Title else d.Title2 end DlTitle,
	  case when @CultureNo = 1 then c.Title else c.Title2 end CurrencyTitle,

	  src.*	  
	  from #Source src
	  join acc.DL d on src.DlID = d.DLID
	  join cfg.Currency c on src.CurrencyID = c.CurrencyID;

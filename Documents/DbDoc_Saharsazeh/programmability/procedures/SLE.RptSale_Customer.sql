-------------------------------------
CREATE    
 PROCEDURE [SLE].RptSale_Customer
(
    @FinicialPeriodID          INT,
    @FromDate                  DATE = NULL,
    @ToDate                    DATE = NULL,
    @SelectedStuff             NVARCHAR(MAX) = NULL,
    @SelectedBranch            NVARCHAR(MAX) = NULL,
    @SelectedSaleModels        NVARCHAR(MAX) = NULL,
    @SelectedSaleGroup         NVARCHAR(MAX) = NULL,
    @SelectedIds               NVARCHAR(MAX) = NULL,
    @SelectedCustomerGroup     NVARCHAR(MAX) = NULL,
    @SelectedStuffGroup        NVARCHAR(MAX) = NULL,
    @SelectedSaleType          NVARCHAR(MAX) = NULL,
    @SelectedSaleArea          NVARCHAR(MAX) = NULL,
    @SelectedStuffAccountGroup NVARCHAR(MAX) = NULL,
	@Source					   TinyINT		 = 1
)
--WITH ENCRYPTION
AS
BEGIN
	DECLARE @Culture        VARCHAR(25),
	        @CultureNo      TINYINT,
	        @tableName      NVARCHAR(255),
	        @tableName1     NVARCHAR(255),
	        @Query          NVARCHAR(MAX);
	
	SET @tableName = CFG.getTempTableName(1);
	SET @tableName1 = CFG.getTempTableName(1);
	
	SET @Culture = CFG.GetuserCulture();
	
	SELECT @CultureNo = CultureNo
	FROM   CFG.CultureInfo
	WHERE  Culture = @Culture;
	

	
		EXEC [SLE].[RptSaleReviewDataSource] 
			@FromDate=@FromDate ,
			@ToDate= @ToDate ,
			@TableName =@tableName,
			@SelectedStuff = @SelectedStuff,
			@SelectedSaleModels = @SelectedSaleModels,
			@SelectedSaleGroup =@SelectedSaleGroup,
			@SelectedCustomerGroup = @SelectedCustomerGroup ,
			@SelectedStuffGroup = @SelectedStuffGroup ,
			@SelectedSaleType = @SelectedSaleType,
			@selectedBranch = @selectedBranch,
			@SelectedSaleArea = @SelectedSaleArea,
			@Source = @Source,
			@SelectedStuffAccountGroup = @SelectedStuffAccountGroup
	
	
	
	SET @Query = 
	    N'Select 
			sum(ISNULL(case when sale.IsReturned=0 then  Sale.PriceInBaseCurrency else 0 end, 0)) Sale,
			sum( ISNULL(case when sale.IsReturned=1 then  Sale.PriceInBaseCurrency else 0 end, 0)) ReturnedSale,
			sum(ISNULL(Sale.PriceInBaseCurrency, 0)  + ISNULL(Sale.DiscountInBaseCurrency, 0)) NetSale,
			sum( ISNULL(Sale.DiscountInBaseCurrency, 0)) Discount,
			sum( ISNULL(Sale.TaxInBaseCurrency, 0))  Tax,
			sum( ISNULL(Sale.DutyInBaseCurrency, 0)) Duty,
			sum( ISNULL(case when sale.IsReturned=0 then Sale.MainQuantity else 0 end, 0)) SaleMainQuantity,
			sum(  ISNULL(case when sale.IsReturned=0 then Sale.SubQuantity else 0 end, 0)) SaleSubQuantity,
			sum(  ISNULL(case when sale.IsReturned=1 then Sale.MainQuantity else 0 end, 0)) ReturnMainQuantity,
			sum(  ISNULL(case when sale.IsReturned=1 then Sale.SubQuantity else 0 end, 0)) ReturnSubQuantity,
			sum( ISNULL(Sale.MainQuantity, 0))  NetMainQuantity,
			sum(  ISNULL(Sale.SubQuantity, 0))  NetSubQuantity,
			sale.CustomerID
		 '+Case when @Source = 3 then N'
		 ,sale.CurrencyID,
		  sum(ISNULL(case when sale.IsReturned = 0 then  Sale.Price else 0 end, 0)) CurrencySalePrice,
          sum( ISNULL(case when sale.IsReturned = 1 then   Sale.Price else 0 end, 0)) CurrencyReturnedPrice,
           sum(ISNULL(Sale.Price, 0)  + ISNULL(Sale.Discount, 0)) CurrencyNet,
          sum( ISNULL(Sale.Discount, 0)) CurrencyDiscount,
          sum( ISNULL(Sale.Tax, 0))  CurrencyTax,
          sum( ISNULL(Sale.Duty, 0)) CurrencyDuty' else '' end+N'
			into ' + @tableName1 + N'
			from ' + @tableName +
			N' as Sale 
			join cfg.party p on sale.customerid=p.PartyID
			join stf.stuff S on Sale.stuffid=S.stuffid
			Group by sale.CustomerID'+case when @Source = 3 then N',sale.CurrencyID' else '' end
	
	EXEC SP_EXECUTESQL @Query
	
	
		SET @Query = 
		N'
		SELECT p.PartyID AS CustomerID,
		p.CustomerCode,
		d.Code,
		d.Title,
		d.Title2,'+
		   Case when @Source = 3 then N'
		   cr.CurrencyID,
		   cr.Title CurrencyTitle,
		   cr.Title2 CurrencyTitle2,' else '' end+N'
		a.*
          
		FROM  cfg.Party AS P
		join ' + @tableName1 + ' a on P.PartyID=a.CustomerID
		join acc.dl d on p.dlid=d.dlid '
		+case when @Source = 3 then ' join cfg.Currency cr on a.CurrencyID = cr.CurrencyID' else '' end
	
	EXEC (@query)
END;


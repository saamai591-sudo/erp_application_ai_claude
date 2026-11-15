------------------------------------- 
CREATE   PROCEDURE [SLE].RptSale_CustomerGroup
(
    @FinicialPeriodID INT,
    @FromDate DATE = NULL,
    @ToDate DATE = NULL,
    @SelectedStuff NVARCHAR(MAX) = NULL,
    @SelectedBranch NVARCHAR(MAX) = NULL,
    @SelectedSaleModels NVARCHAR(MAX) = NULL,
    @SelectedSaleGroup NVARCHAR(MAX) = NULL,
    @SelectedIds NVARCHAR(MAX) = NULL,
    @SelectedCustomer NVARCHAR(MAX) = NULL,
    @SelectedStuffGroup NVARCHAR(MAX) = NULL,
    @SelectedSaleType NVARCHAR(MAX) = NULL,
    @SelectedSaleArea NVARCHAR(MAX) = NULL,
    @SelectedStuffAccountGroup NVARCHAR(MAX) = NULL,
	@Source						TinyInt = 1
)
--WITH ENCRYPTION
AS
BEGIN

    DECLARE @userId INT = CFG.GetuserID(),
     @tableName      NVARCHAR(255),
	        @tableName1     NVARCHAR(255),
	        @Query          NVARCHAR(MAX);
	
	SET @tableName = CFG.getTempTableName(1);
	SET @tableName1 = CFG.getTempTableName(1);
    
	
		EXEC [SLE].[RptSaleReviewDataSource] 
			@FromDate=@FromDate ,
			@ToDate= @ToDate ,
			@TableName =@tableName,
			@SelectedStuff = @SelectedStuff,
			@SelectedCustomer = @SelectedCustomer,
			@SelectedSaleModels = @SelectedSaleModels,
			@SelectedSaleGroup =@SelectedSaleGroup,
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
		p.CustomerGroupID
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
		Group by p.CustomerGroupID'+case when @Source = 3 then N',sale.CurrencyID' else '' end
	
	EXEC SP_EXECUTESQL @Query
	

	
	SET @Query = 
	    N'
    SELECT g.GroupID,
           g.Code,
           g.Title,
           g.Title2,'+
		   Case when @Source = 3 then N'
		   cr.CurrencyID,
		   cr.Title CurrencyTitle,
		   cr.Title2 CurrencyTitle2,' else '' end+N'
           a.*
          
    FROM  cfg.[Group] AS g
           join ' + @tableName1 + ' a on a.CustomerGroupID=g.GroupID
            '+case when @Source = 3 then ' join cfg.Currency cr on a.CurrencyID = cr.CurrencyID' else '' end
	
	EXEC (@query)

  
END;

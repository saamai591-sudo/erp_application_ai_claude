-------------------------------------
CREATE      PROC [SLE].RptSale_SaleArea
(
    @FromDate DATE = NULL,
    @ToDate DATE = NULL,
    @SelectedStuff NVARCHAR(MAX) = NULL,
    @SelectedCustomer NVARCHAR(MAX) = NULL,
    @SelectedSaleModels NVARCHAR(MAX) = NULL,
    @SelectedSaleGroup NVARCHAR(MAX) = NULL,
    @SelectedIds NVARCHAR(MAX) = NULL,
    @SelectedCustomerGroup NVARCHAR(MAX) = NULL,
    @SelectedStuffGroup NVARCHAR(MAX) = NULL,
    @SelectedSaleType NVARCHAR(MAX) = NULL,
    @selectedBranch NVARCHAR(MAX) = NULL,
    @SelectedStuffAccountGroup NVARCHAR(MAX) = Null,
	@Source int = 1
)

--WITH ENCRYPTION 
AS
BEGIN
    DECLARE @Query          NVARCHAR(MAX),
            @tableName      NVARCHAR(255),
            @tableName1     NVARCHAR(255);
    SET @tableName = CFG.getTempTableName(1);
    SET @tableName1 = CFG.getTempTableName(1);

    DECLARE @userId INT = CFG.GetuserID();
	
    EXEC [SLE].[RptSaleReviewDataSource] 
			    @FromDate=@FromDate ,
			    @ToDate= @ToDate ,
			    @TableName =@tableName,
			    @SelectedStuff = @SelectedStuff,
			    @SelectedCustomer = @SelectedCustomer,
			    @SelectedSaleModels = @SelectedSaleModels,
			    @SelectedSaleGroup =@SelectedSaleGroup,
			    @SelectedCustomerGroup = @SelectedCustomerGroup ,
			    @SelectedStuffGroup = @SelectedStuffGroup ,
			    @SelectedSaleType = @SelectedSaleType,
			    @selectedBranch = @selectedBranch,
			    @Source = @Source,
                @SelectedStuffAccountGroup = @SelectedStuffAccountGroup

	SET @Query = 
	    N'Select sum(ISNULL(case when sale.IsReturned = 0 then  Sale.PriceInBaseCurrency else 0 end, 0)) SalePrice,
          sum( ISNULL(case when sale.IsReturned = 1 then   Sale.PriceInBaseCurrency else 0 end, 0)) ReturnedPrice,
           sum(ISNULL(Sale.PriceInBaseCurrency, 0)  + ISNULL(Sale.DiscountInBaseCurrency, 0)) Net,
          sum( ISNULL(Sale.DiscountInBaseCurrency, 0)) Discount,
          sum( ISNULL(Sale.TaxInBaseCurrency, 0))  Tax,
          sum( ISNULL(Sale.DutyInBaseCurrency, 0)) Duty ,         
          sum( ISNULL(case when sale.IsReturned = 0 then Sale.MainQuantity else 0 end, 0)) SaleMainQuantity,
         sum(  ISNULL(case when sale.IsReturned=0 then Sale.SubQuantity else 0 end, 0)) SaleSubQuantity,
         sum(  ISNULL(case when sale.IsReturned=1 then Sale.MainQuantity else 0 end, 0)) ReturnMainQuantity,
         sum(  ISNULL(case when sale.IsReturned=1 then Sale.SubQuantity else 0 end, 0)) ReturnSubQuantity,
          sum( ISNULL(Sale.MainQuantity, 0))  NetMainQuantity,
         sum(  ISNULL(Sale.SubQuantity, 0))  NetSubQuantity,

         sale.SaleAreaID'+Case when @Source = 3 then N'
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
             Group by sale.SaleAreaID'+case when @Source = 3 then N',sale.CurrencyID' else '' end

			 print @Query
	
	EXEC SP_EXECUTESQL @Query
	     
	SET @Query = 
	    N'
    SELECT ''sa''+cast(b.SaleAreaID as Nvarchar(100)) SaleAreaID,
           B.Code,
           B.Title,
           B.Title2,'+
		    Case when @Source = 3 then N'
		   cr.CurrencyID,
		   cr.Title CurrencyTitle,
		   cr.Title2 CurrencyTitle2,' else '' end+N'
           a.*
          
          
    FROM  SLE.SaleArea AS B
           join ' + @tableName1 + ' a on a.SaleAreaID=''sa''+cast(b.SaleAreaID as NVarchar(10))
		  '+case when @Source = 3 then ' join cfg.Currency cr on a.CurrencyID = cr.CurrencyID' else '' end
	
	EXEC (@query)
END;


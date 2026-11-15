------------------------------------- START #7425
CREATE   PROC [SLE].RptSale_StuffGroup
(
    @FromDate DATE = NULL,
    @EndDate DATE = NULL,
    @SelectedStuff VARCHAR(MAX) = NULL,
    @SelectedCustomer VARCHAR(MAX) = NULL,
    @SelectedSaleModels NVARCHAR(MAX) = NULL,
    @SelectedSaleGroup NVARCHAR(MAX) = NULL,
    @SelectedIds NVARCHAR(MAX) = NULL,
    @SelectedCustomerGroup NVARCHAR(MAX) = NULL,
    @Branch NVARCHAR(MAX) = NULL,
    @SelectedSaleType NVARCHAR(MAX) = NULL,
    @SelectedSaleArea NVARCHAR(MAX) = NULL,
    @SelectedStuffAccountGroup NVARCHAR(MAX) = NULL,
	@Source tinyint = 1
)

--WITH ENCRYPTION 
AS
DECLARE @tableName NVARCHAR(20),
		@tableName1 NVARCHAR(20),
        @query NVARCHAR(MAX),
        @Culture VARCHAR(25),
        @CultureNo TINYINT;

SET @tableName = CFG.getTempTableName(1);
SET @tableName1 = CFG.getTempTableName(1);

	EXEC [SLE].[RptSaleReviewDataSource] 
			@FromDate=@FromDate ,
			@ToDate= @EndDate ,
			@TableName =@tableName,
			@SelectedStuff = @SelectedStuff,
			@SelectedCustomer = @SelectedCustomer,
			@SelectedSaleModels = @SelectedSaleModels,
			@SelectedSaleGroup =@SelectedSaleGroup,
			@SelectedCustomerGroup = @SelectedCustomerGroup ,
			@SelectedStuffGroup = DEFAULT ,
			@SelectedSaleType = @SelectedSaleType,
			@selectedBranch = @Branch,
			@SelectedSaleArea = @SelectedSaleArea,
			@Source = @Source,
			@SelectedStuffAccountGroup = @SelectedStuffAccountGroup

	SET @Query = 
	    N'Select sum(ISNULL(case when sale.IsReturned=0 then  Sale.PriceInBaseCurrency else 0 end, 0)) SalePrice,
				 sum( ISNULL(case when sale.IsReturned=1 then  Sale.PriceInBaseCurrency else 0 end, 0)) ReturnedPrice,
				 sum(ISNULL(Sale.PriceInBaseCurrency, 0)  + ISNULL(Sale.DiscountInBaseCurrency, 0)) Net,
				 sum( ISNULL(Sale.DiscountInBaseCurrency, 0)) Discount,
				 sum( ISNULL(Sale.TaxInBaseCurrency, 0))  Tax,
				 sum( ISNULL(Sale.DutyInBaseCurrency, 0)) Duty,
				 sum( ISNULL(case when sale.IsReturned=0 then Sale.MainQuantity else 0 end, 0)) SaleMainQuantity,
				 sum(  ISNULL(case when sale.IsReturned=0 then Sale.SubQuantity else 0 end, 0)) SaleSubQuantity,
				 sum(  ISNULL(case when sale.IsReturned=1 then Sale.MainQuantity else 0 end, 0)) ReturnMainQuantity,
				 sum(  ISNULL(case when sale.IsReturned=1 then Sale.SubQuantity else 0 end, 0)) ReturnSubQuantity,
				 sum( ISNULL(Sale.MainQuantity, 0))  NetMainQuantity,
				 sum(  ISNULL(Sale.SubQuantity, 0))  NetSubQuantity,
				 s.StuffGroupID'+Case when @Source = 3 then N'
		 ,sale.CurrencyID,
		  sum(ISNULL(case when sale.IsReturned = 0 then  Sale.Price else 0 end, 0)) CurrencySalePrice,
          sum( ISNULL(case when sale.IsReturned = 1 then   Sale.Price else 0 end, 0)) CurrencyReturnedPrice,
           sum(ISNULL(Sale.Price, 0)  + ISNULL(Sale.Discount, 0)) CurrencyNet,
          sum( ISNULL(Sale.Discount, 0)) CurrencyDiscount,
          sum( ISNULL(Sale.Tax, 0))  CurrencyTax,
          sum( ISNULL(Sale.Duty, 0)) CurrencyDuty' else '' end+N'
				 into ' + @tableName1 + N'
             from ' + @tableName + N' as Sale 
             join stf.stuff S on Sale.stuffid=S.stuffid          
             Group by s.StuffGroupID'+case when @Source = 3 then N',sale.CurrencyID' else '' end
exec(@query)

SET @Culture = CFG.GetuserCulture();

SELECT @CultureNo = CultureNo
FROM CFG.CultureInfo
WHERE Culture = @Culture;

DECLARE @resTablename NVARCHAR(10);
SET @resTablename = CFG.getTempTableName(1);

SET @query= N'SELECT    s.StuffGroupID ,
						s.Code AS StuffGroupCode ,
						case when @CultureNo = 1 then s.Title else s.Title2 end as StuffGroupTitle, 
						s.ParentID ,
						A.SalePrice ,
						A.ReturnedPrice,
						A.Net ,
						A.Discount,
						A.Tax ,
						A.Duty ,
						A.SaleMainQuantity,
						A.SaleSubQuantity ,
						A.ReturnMainQuantity ,
						A.ReturnSubQuantity,
						A.NetMainQuantity,
						A.NetSubQuantity'
						+case when @source = 3 then	N'
						,a.CurrencyID,
						A.CurrencySalePrice ,
						A.CurrencyReturnedPrice,
						A.CurrencyNet ,
						A.CurrencyDiscount,
						A.CurrencyTax ,
						A.CurrencyDuty ' else '' end+N'
			into ' + @resTablename +'
         FROM   STF.StuffGroup s  
         LEFT JOIN ' + @tableName1 + N' A ON A.StuffGroupID = s.StuffGroupID';
		
EXECUTE sp_executesql @query,
					 N'@CultureNo Tinyint',
					 @CultureNo = @CultureNo

set @query = N'
;with C as
(
  select T.StuffGroupID,
         T.SalePrice,
         T.ReturnedPrice,
		 T.Net,
		 T.Discount,
		 T.Tax,
		 T.Duty,'+Case when @Source = 3 then N'
		 T.CurrencyID,
		 T.CurrencySalePrice,
		 T.CurrencyReturnedPrice,
		 T.CurrencyNet,
		 T.CurrencyDiscount,
		 T.CurrencyTax,
		 T.CurrencyDuty,' else '' End + N'
		 T.SaleMainQuantity,
		 T.SaleSubQuantity,
		 T.ReturnMainQuantity,
		 T.ReturnSubQuantity,
		 T.NetMainQuantity,
		 T.NetSubQuantity,
         T.StuffGroupID as RootID
  from ' + @resTablename +' T
  union all
  select T.StuffGroupID,
         T.SalePrice,
         T.ReturnedPrice,
		 T.Net,
		 T.Discount,
		 T.Tax,
		 T.Duty,'+case when @Source = 3 then N'
		 T.CurrencyID,
		 T.CurrencySalePrice,
		 T.CurrencyReturnedPrice,
		 T.CurrencyNet,
		 T.CurrencyDiscount,
		 T.CurrencyTax,
		 T.CurrencyDuty,' else '' End + N'
		 T.SaleMainQuantity,
		 T.SaleSubQuantity,
		 T.ReturnMainQuantity,
		 T.ReturnSubQuantity,
		 T.NetMainQuantity,
		 T.NetSubQuantity,
         C.RootID
  from ' + @resTablename +' T
    inner join C 
      on T.ParentId = C.StuffGroupID
)
select  T.StuffGroupID,
        T.ParentID,
	    T.StuffGroupCode Code,
        T.StuffGroupTitle Title,
		S.SalePrice,
		S.ReturnedPrice,
		S.Net,
		S.Discount,
		S.Tax,
		S.Duty,'+Case when @Source = 3 then N'
		cr.Title CurrencyTitle,
		cr.Title2 CurrencyTitle2,
		S.CurrencySalePrice,
		S.CurrencyReturnedPrice,
		S.CurrencyNet,
		S.CurrencyDiscount,
		S.CurrencyTax,
		S.CurrencyDuty,' else '' End+N'
		S.SaleMainQuantity,
		S.SaleSubQuantity,
		S.ReturnMainQuantity,
		S.ReturnSubQuantity,
		S.NetMainQuantity,
		S.NetSubQuantity
into #T
from ' + @resTablename +' T'+
Case when @Source = 3 then N'
join cfg.Currency cr on t.CurrencyID = cr.CurrencyID ' else '' end +N'
inner join (
            select RootID,
                sum(SalePrice) as SalePrice,
				sum(Net) as Net,
				sum(ReturnedPrice) as ReturnedPrice,
				sum(Discount) as Discount,
				sum(Tax) as Tax,
				sum(Duty) as Duty,'+Case when @Source = 3 then N'
				sum(CurrencySalePrice) as		CurrencySalePrice,
				sum(CurrencyNet) as				CurrencyNet,
				sum(CurrencyReturnedPrice) as	CurrencyReturnedPrice,
				sum(CurrencyDiscount) as		CurrencyDiscount,
				sum(CurrencyTax) as				CurrencyTax,
				sum(CurrencyDuty) as			CurrencyDuty,' else '' End+N'
				sum(SaleMainQuantity) as SaleMainQuantity,
				sum(SaleSubQuantity) as SaleSubQuantity,
				sum(ReturnMainQuantity) as ReturnMainQuantity,
				sum(ReturnSubQuantity) as ReturnSubQuantity,
				sum(NetMainQuantity) as NetMainQuantity,
				sum(NetSubQuantity) as NetSubQuantity
            from C
            group by RootID
            ) as S
on T.StuffGroupID = S.RootID
order by T.StuffGroupID
option (maxrecursion 0)

select * from  #T where Net <> 0 '

EXEC (@query);


-------------------------------------
CREATE    PROC SLE.RptSale_Stuff
(
    @FromDate DATE,
    @EndDate DATE,
    @Branch NVARCHAR(MAX) = NULL,
    @Customer NVARCHAR(MAX) = NULL,
    @SelectedSaleModels NVARCHAR(MAX) = NULL,
    @SelectedSaleGroup NVARCHAR(MAX) = NULL,
    @SelectedIds NVARCHAR(MAX) = NULL,
    @SelectedCustomerGroup NVARCHAR(MAX) = NULL,
    @SelectedStuffGroup NVARCHAR(MAX) = NULL,
    @SelectedSaleType NVARCHAR(MAX) = NULL,
    @SelectedSaleArea NVARCHAR(MAX) = NULL,
    @SelectedStuffAccountGroup NVARCHAR(MAX) = Null,
	@Source					TinyInt = 1
)
--WITH ENCRYPTION
AS
BEGIN
    DECLARE @UserID INT = CFG.GetuserID(),
	        @tableName      NVARCHAR(255),
	        @tableName1     NVARCHAR(255),
	        @Query          NVARCHAR(MAX);
	
	SET @tableName = CFG.getTempTableName(1);
	SET @tableName1 = CFG.getTempTableName(1);
	
	EXEC [SLE].[RptSaleReviewDataSource] 
		@FromDate=@FromDate,
		@ToDate=@EndDate,
		@TableName=@tableName,			
		@SelectedCustomer=@Customer ,
		@SelectedSaleModels=@SelectedSaleModels ,
		@SelectedSaleGroup=@SelectedSaleGroup ,
		@SelectedIds=@SelectedIds ,
		@SelectedCustomerGroup=@SelectedCustomerGroup ,
		@SelectedStuffGroup=@SelectedStuffGroup ,
		@SelectedSaleType=@SelectedSaleType ,
		@selectedBranch= @Branch,
		@SelectedSaleArea= @SelectedSaleArea,
		@Source = @Source,
		@SelectedStuffAccountGroup = @SelectedStuffAccountGroup
			
	SET @Query = 
	    N'Select
			sum(ISNULL(case when sale.IsReturned=0 then  Sale.PriceInBaseCurrency else 0 end, 0)) SalePrice,
			sum( ISNULL(case when sale.IsReturned=1 then  Sale.PriceInBaseCurrency else 0 end, 0)) ReturnPrice,
			sum(ISNULL(Sale.PriceInBaseCurrency, 0)  + ISNULL(Sale.DiscountInBaseCurrency, 0)) Net,
			sum( ISNULL(Sale.DiscountInBaseCurrency, 0)) Discount,
			sum( ISNULL(Sale.TaxInBaseCurrency, 0))  Tax,
			sum( ISNULL(Sale.DutyInBaseCurrency, 0)) Duty,
			sum( ISNULL(Sale.MainQuantity, 0))  MainQuantity,
			sum(  ISNULL(Sale.SubQuantity, 0))  SubQuantity,
			s.StuffID'+Case when @Source = 3 then N'
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
			join stf.stuff s on sale.StuffID=S.StuffID
			join stf.stuffDetail SD on Sale.stuffid=SD.stuffid
			Group by s.StuffID'+case when @Source = 3 then N',sale.CurrencyID' else '' end
	
	EXEC SP_EXECUTESQL @Query
	
	SET @Query = 
		N'
		DECLARE @Culture VARCHAR(25),
		@CultureNo TINYINT;


		SET @Culture = CFG.GetuserCulture();

		SELECT @CultureNo = CultureNo
		FROM CFG.CultureInfo
		WHERE Culture = @Culture;

		DECLARE @Stuff NVARCHAR(100),
				@Service NVARCHAR(100);

		SELECT @Stuff = lev.[Value]
		FROM CFG.LocalizeEnum le
		JOIN CFG.LocalizeEnumValue lev
		ON lev.LocalizeEnumID = le.LocalizeEnumID
		WHERE le.Enum = ''MeasureUnitTypes''
		AND le.Item = ''Stuff''
		AND lev.Culture = @Culture;

		SELECT @Service = lev.[Value]
		FROM CFG.LocalizeEnum le
		JOIN CFG.LocalizeEnumValue lev
		ON lev.LocalizeEnumID = le.LocalizeEnumID
		WHERE le.Enum = ''MeasureUnitTypes''
		AND le.Item = ''Service''
		AND lev.Culture = @Culture;

		SELECT CASE
		WHEN stf.Type = 0 THEN
		@Stuff
		ELSE
		@Service
		END StuffType,
		stf.StuffID,
		[STF].[GetStuffCode](stf.StuffID) Stuff1Code,
		sd.TechnicalCode,
		CASE
		WHEN @CultureNo = 1 THEN
		stf.Title
		WHEN @CultureNo = 2 THEN
		stf.Title2
		END AS Stuff1Title,
		CASE
		WHEN @CultureNo = 1 THEN
		Mainunit.Title
		WHEN @CultureNo = 2 THEN
		Mainunit.Title2
		END AS Mainunit,
		CASE
		WHEN @CultureNo = 1 THEN
		Subunit.Title
		WHEN @CultureNo = 2 THEN
		Subunit.Title2
		END AS Subunit,
		stf.UniqueTaxID AS UniqueTaxID,'+
		   Case when @Source = 3 then N'
		   cr.CurrencyID,
		   cr.Title CurrencyTitle,
		   cr.Title2 CurrencyTitle2,' else '' end+N'
		a.*				
		FROM  stf.stuff stf
		join stf.stuffdetail sd on stf.stuffid=sd.stuffid
		join stf.MeasureUnit Mainunit on stf.MainMeasureUnitID=Mainunit.MeasureUnitID
		left join stf.MeasureUnit Subunit on sd.MeasureSubUnitID=Subunit.MeasureUnitID
		join ' + @tableName1 + ' a on a.stuffid=stf.stuffid
    '+case when @Source = 3 then ' join cfg.Currency cr on a.CurrencyID = cr.CurrencyID' else '' end
	
	EXEC SP_EXECUTESQL @Query
END;



CREATE    PROC [CFG].RptGrossProfit_Document
    (
        @FromDate DATE ,
        @EndDate DATE ,
        @Branch NVARCHAR(MAX) = NULL ,
        @Customer NVARCHAR(MAX) = NULL ,
        @SelectedStuffs NVARCHAR(MAX) = NULL ,
        @SelectedSaleModels NVARCHAR(MAX) = NULL ,
        @SelectedSaleGroup NVARCHAR(MAX) = NULL ,
        @SelectedCustomerGroup NVARCHAR(MAX) = NULL ,
        @SelectedStuffGroup NVARCHAR(MAX) = NULL ,
        @CostOfBuyingType TINYINT = 1,
		@SelectedSaleArea NVARCHAR(MAX) = NULL 
    )
--WITH ENCRYPTION
AS
    DECLARE @Stuff NVARCHAR(100) ,
            @Service NVARCHAR(100) ,
            @UserID INT ,
            @DateType TINYINT ,
            @DateFormat VARCHAR(10) ,
            @Culture VARCHAR(10) ,
            @CultureNo TINYINT ,
            @invoice NVARCHAR(100),
			@returnSaleInvoice NVARCHAR(100),
			@PosInvoice NVARCHAR(100),
			@ReturnPosInvoice NVARCHAR(100)

    SELECT @invoice = lev.[Value]
    FROM   CFG.LocalizeEnum le
           JOIN CFG.LocalizeEnumValue lev ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE  le.Enum = 'DocumentNumTypes'
           AND le.Item = 'Invoice'
           AND lev.Culture = CFG.GetuserCulture();

    SELECT @returnSaleInvoice = lev.[Value]
    FROM   CFG.LocalizeEnum le
           JOIN CFG.LocalizeEnumValue lev ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE  le.Enum = 'DocumentNumTypes'
           AND le.Item = 'ReturnedSaleInvoice'
           AND lev.Culture = CFG.GetuserCulture();
           
        SELECT @PosInvoice = '' + lev.[Value] + ''
    FROM   CFG.LocalizeEnum le
           JOIN CFG.LocalizeEnumValue lev ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE  le.Enum = 'RevisionCostType'
           AND le.Item = 'PosInvoice'
           AND lev.Culture = CFG.GetuserCulture();    
           
    SELECT @ReturnPosInvoice = '' + lev.[Value] + ''
    FROM   CFG.LocalizeEnum le
           JOIN CFG.LocalizeEnumValue lev ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE  le.Enum = 'RevisionCostType'
           AND le.Item = 'ReturnPosInvoice'
           AND lev.Culture = CFG.GetuserCulture();  

    SET @UserID = CFG.GetuserID();
    SET @Culture = CFG.GetuserCulture();

    SELECT @CultureNo = CultureNo
    FROM   CFG.CultureInfo
    WHERE  Culture = @Culture;

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
        

DECLARE @TableName     NVARCHAR(MAX),
	@TableName2 NVARCHAR(MAX),
	@Query         NVARCHAR(MAX);
        
SET @TableName = cfg.getTempTableName(1)

SET @TableName2=cfg.getTempTableName(2)
        
		
	CREATE TABLE #Invoice
    (
        VALUE INT
    );
    
	CREATE TABLE #ReturnedInvoice
    (
        VALUE INT
    );

	EXEC SLE.RptSaleReviewDataSource
		@FromDate = @FromDate,
		@ToDate = @EndDate,
		@TableName = @TableName,
		@SelectedStuff = @SelectedStuffs,
		@SelectedCustomer = @Customer,
		@SelectedSaleModels = @SelectedSaleModels,
		@SelectedSaleGroup = @SelectedSaleGroup,
		@SelectedIds = NULL,
		@SelectedCustomerGroup = @SelectedCustomerGroup ,
		@SelectedStuffGroup = @SelectedStuffGroup,
		@SelectedSaleType = Null,
		@selectedBranch = @Branch,
		@SelectedSaleArea = @SelectedSaleArea,
		@CostOfBuyingType = @CostOfBuyingType,
		@Source = 2

		DECLARE @basePrecision INT = CFG.GetBaseCurrencyPrecision();

SET @Query = 
    N'
SELECT HeaderID,CustomerID,Number,Date,
[Type],
       Sum(ISNULL(priceInBaseCurrency,0))            Price,
       Sum(ISNULL(DiscountInBaseCurrency, 0)) Discount,
       Sum(ISNULL(case when IsReturned=1 then 0 else  MainQuantity end, 0)) SaleMainQuantity,
       Sum(ISNULL(case when IsReturned=0 then 0 else  MainQuantity end, 0)) ReturnMainQuantity,
       Sum(ISNULL(case when IsReturned=1 then 0 else  SubQuantity end, 0)) SaleSubQuantity,
       Sum(ISNULL(case when IsReturned=0 then 0 else  SubQuantity end, 0)) ReturnSubQuantity,
       Sum(ISNULL(CostOfBuying , 0)) AS CostOfBuying      
       into ' + @TableName2 + N' 
FROM   ' + @TableName + N'   
GROUP BY   HeaderID,[Type],CustomerID,Number,Date '
                       
EXEC (@Query)
SET @Query = 
    N'select 
			
			''I''+cast(i.InvoiceID as nvarchar(50)) ID ,
			@invoice Name,
			 ''invoice'' [DocType] ,
			 a.Number,
			 a.[Date],
			 CFG.GetCLRSaturnDate(A.[Date], @DateFormat, 0, @DateType) [Date_Date] ,
			 CASE WHEN @CultureNo = 1 THEN c.Title
                           WHEN @CultureNo = 2 THEN c.Title2
                      END AS CurrencyTitle ,
                      d.code as DlCode,
                       CASE WHEN @CultureNo = 1 THEN
                               p.Title + '' '' + ISNULL(p.LastName, '''')
                           WHEN @CultureNo = 2 THEN
                               p.Title2 + '' '' + ISNULL(p.LastName2, '''')
                      END AS PartyTitle ,
                      CASE WHEN p.Type = 0 THEN p.IdentificationCode
                           ELSE p.EconomicCode
                      END NationalCode ,
                      null as VoucherNumber,
                      null as VoucherDate,
                      null as Date_VoucherDate ,
					  a.Price,
					  a.Discount,
					  a.price+a.Discount SaleNet,
					  a.CostOfBuying,
				a.Price+a.Discount+isnull(a.CostOfBuying,0) ProfitAndLoss ,
				CASE WHEN (a.Price+a.Discount) = 0 THEN 0.0
				ELSE ROUND(( (a.Price+a.Discount+a.CostOfBuying) /(a.Price+a.Discount) ) * 100, 2)
				END AS ProfitAndLossPercent
             
             from '+ @TableName2+N'   a
				join Sle.Invoice i on i.InvoiceID=a.HeaderID
				join cfg.Currency c on i.CurrencyID=c.CurrencyId
				join cfg.party p on a.CustomerID=p.PartyID
				join acc.dl d on p.dlid=d.dlid
      where a.[Type]=''Invoice''
      
	  union all
      
      select 
			''R''+cast(i.ReturnedSaleInvoiceID as nvarchar(50)) ID ,
			@returnSaleInvoice Name,
			 ''invoice'' [DocType] ,
			 a.Number,
			 a.[Date],
			 CFG.GetCLRSaturnDate(A.[Date], @DateFormat, 0, @DateType) [Date_Date] ,
			 CASE WHEN @CultureNo = 1 THEN c.Title
                           WHEN @CultureNo = 2 THEN c.Title2
                      END AS CurrencyTitle ,
                      d.code as DlCode,
                       CASE WHEN @CultureNo = 1 THEN
                               p.Title + '' '' + ISNULL(p.LastName, '''')
                           WHEN @CultureNo = 2 THEN
                               p.Title2 + '' '' + ISNULL(p.LastName2, '''')
                      END AS PartyTitle ,
                      CASE WHEN p.Type = 0 THEN p.IdentificationCode
                           ELSE p.EconomicCode
                      END NationalCode ,
                      null as VoucherNumber,
                      null as VoucherDate,
                      null as Date_VoucherDate ,
					  a.Price,
					  a.Discount,
					  a.price+a.Discount SaleNet,
					  a.CostOfBuying,
				a.Price+a.Discount+isnull(a.CostOfBuying,0) ProfitAndLoss ,
				CASE WHEN (a.Price+a.Discount) = 0 THEN 0.0
				ELSE ROUND(( (a.Price+a.Discount+a.CostOfBuying) /(a.Price+a.Discount) ) * 100, 2)
				END AS ProfitAndLossPercent
             
             from '+ @TableName2+N'   a
join sle.ReturnedSaleInvoice  i on i.ReturnedSaleInvoiceID=a.HeaderID
join cfg.Currency c on i.CurrencyID=c.CurrencyId
join cfg.party p on a.CustomerID=p.PartyID
join acc.dl d on p.dlid=d.dlid

      where a.[Type]=''ReturnInvoice''
      
	   union all
      
      select 
			
			''P''+cast(i.PosInvoiceID as nvarchar(50)) ID ,
			@PosInvoice Name,
			 ''invoice'' [DocType] ,
			 a.Number,
			 a.[Date],
			 CFG.GetCLRSaturnDate(A.[Date], @DateFormat, 0, @DateType) [Date_Date] ,
			 CASE WHEN @CultureNo = 1 THEN c.Title
                           WHEN @CultureNo = 2 THEN c.Title2
                      END AS CurrencyTitle ,
                      d.code as DlCode,
                       CASE WHEN @CultureNo = 1 THEN
                               p.Title + '' '' + ISNULL(p.LastName, '''')
                           WHEN @CultureNo = 2 THEN
                               p.Title2 + '' '' + ISNULL(p.LastName2, '''')
                      END AS PartyTitle ,
                      CASE WHEN p.Type = 0 THEN p.IdentificationCode
                           ELSE p.EconomicCode
                      END NationalCode ,
                      null as VoucherNumber,
                      null as VoucherDate,
                      null as Date_VoucherDate ,
					  a.Price,
					  a.Discount,
					  a.price+a.Discount SaleNet,
					  a.CostOfBuying,
				a.Price+a.Discount+isnull(a.CostOfBuying,0) ProfitAndLoss ,
				CASE WHEN (a.Price+a.Discount) = 0 THEN 0.0
				ELSE ROUND(( (a.Price+a.Discount+a.CostOfBuying) /(a.Price+a.Discount) ) * 100, 2)
				END AS ProfitAndLossPercent
             
             from '+ @TableName2+N'   a
join POS.PosInvoice  i on i.PosInvoiceID=a.HeaderID
join cfg.Currency c on c.CurrencyID=-1
join cfg.party p on a.CustomerID=p.PartyID
left join acc.dl d on p.dlid=d.dlid

      where a.[Type]=''PosInvoice''
      
	   union all
      
      select 
			
			''P''+cast(i.PosInvoiceID as nvarchar(50)) ID ,
			@ReturnPosInvoice Name,
			 ''invoice'' [DocType] ,
			 a.Number,
			 a.[Date],
			 CFG.GetCLRSaturnDate(A.[Date], @DateFormat, 0, @DateType) [Date_Date] ,
			 CASE WHEN @CultureNo = 1 THEN c.Title
                           WHEN @CultureNo = 2 THEN c.Title2
                      END AS CurrencyTitle ,
                      d.code as DlCode,
                       CASE WHEN @CultureNo = 1 THEN
                               p.Title + '' '' + ISNULL(p.LastName, '''')
                           WHEN @CultureNo = 2 THEN
                               p.Title2 + '' '' + ISNULL(p.LastName2, '''')
                      END AS PartyTitle ,
                      CASE WHEN p.Type = 0 THEN p.IdentificationCode
                           ELSE p.EconomicCode
                      END NationalCode ,
                      null as VoucherNumber,
                      null as VoucherDate,
                      null as Date_VoucherDate ,
					  a.Price,
					  a.Discount,
					  a.price+a.Discount SaleNet,
					  a.CostOfBuying,
				a.Price+a.Discount+isnull(a.CostOfBuying,0) ProfitAndLoss ,
				CASE WHEN (a.Price+a.Discount) = 0 THEN 0.0
				ELSE ROUND(( (a.Price+a.Discount+a.CostOfBuying) /(a.Price+a.Discount) ) * 100, 2)
				END AS ProfitAndLossPercent
             
             from '+ @TableName2+N'   a
join POS.PosInvoice  i on i.PosInvoiceID=a.HeaderID
join cfg.Currency c on c.CurrencyID=-1
join cfg.party p on a.CustomerID=p.PartyID
left join acc.dl d on p.dlid=d.dlid

      where a.[Type]=''PosReturnInvoice''      
'

EXECUTE sp_executesql @query,
	     N' 
			@DateType TINYINT ,
            @DateFormat VARCHAR(10) ,
            @Culture VARCHAR(10) ,
            @CultureNo TINYINT ,
            @invoice NVARCHAR(100),
			@returnSaleInvoice NVARCHAR(100),
			@PosInvoice NVARCHAR(100),
			@ReturnPosInvoice NVARCHAR(100)',
	    @DateType =@DateType ,
            @DateFormat =@DateFormat ,
            @Culture= @Culture ,
            @CultureNo = @CultureNo ,
            @invoice = @invoice ,
			@returnSaleInvoice = @returnSaleInvoice,
			@PosInvoice = @PosInvoice ,
			@ReturnPosInvoice=@ReturnPosInvoice;

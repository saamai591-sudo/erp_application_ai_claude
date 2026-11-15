
CREATE   PROCEDURE [CFG].GetManualReceiptList
(
    @FinancialPeriodID     INT,
    @PageNumber            INT,
    @RowspPage             INT,
    @Sort                  NVARCHAR(MAX) = NULL,
    @Filter                NVARCHAR(MAX) = NULL
)
AS
	DECLARE @UserID                  INT,
	        @DateType                TINYINT,
	        @DateFormat              VARCHAR(10),
	        @ViewRelatedToUser		 INT,
	        @ViewRelatedToOthers	 NVARCHAR(MAX),
	        @Culture                 VARCHAR(10),
            @UnauthorizedUsers NVARCHAR(MAX);
	
	SET @Culture = CFG.GetuserCulture();
	
	
	SET @UserID = CFG.GetuserID();
	
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
	
	SELECT @ViewRelatedToUser = UserID
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'ManualReceipt'
		  AND AccessKey = 'ViewRelatedToUser'
		  AND UserID = @UserID;

	SELECT @ViewRelatedToOthers = UserID ,
           @UnauthorizedUsers = Users
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'ManualReceipt'
		  AND AccessKey = 'ViewRelatedToOthers'
		  AND UserID = @UserID;

	IF @Sort IS NULL
	   OR @Sort = ''
	    SET @Sort = 'Number ';
	    
	 SELECT * INTO   #vwBranchAccess
	 FROM cfg.vwBranchAccess AS vba; 
	    
	
	DECLARE @Query NVARCHAR(MAX);    
	SET @Query = 'WITH Query_Result 
			As (
				SELECT	i.ManualReceiptID, 
						i.FinancialPeriodID, 
						i.BranchID, 
						i.PartyID, 
						i.CurrencyID,
						ManualReceiptType, 
						ManualReceiptSubject, 
						i.InstallmentPaymentItemID,
						i.PurchaseInvoiceID, 
						i.InvoiceID,
						i.SaleContractID,
						i.ReturnedSaleInvoiceID, 
						i.ReturnInvoiceID,
						i.CalculationResultID, 
						i.Number, 
						i.[Date], 
						i.Amount, 
						[Description], 
						i.Version,
						i.Creator, 
						i.CreationDate, 
						i.LastEditor, 
						i.LastEditionDate,
						CFG.GetCLRSaturnDate(i.CreationDate, @DateFormat, 0, @DateType) CreateDateString,
						CFG.GetCLRSaturnDate(i.LastEditionDate, @DateFormat, 0, @DateType) EditionDateString,
						u1.Name CreatorUserName,
						u2.Name EditorName,
						C.Title,
						d.Code PartyCode,
						p.Title + '' '' + IsNull(P.LastName,'''') as PartyName,
						CFG.GetCLRSaturnDate(i.[Date], @DateFormat, 0, @DateType)  as PersianDate,
						cfg.Branch.Title as BranchTitle,
						CASE
						   WHEN i.PurchaseInvoiceID IS NOT NULL THEN
							   ISNULL(pi.InvoiceNumber, cast (pi.Number as nvarchar(200)))
						   WHEN i.InstallmentPaymentItemID IS NOT NULL THEN
							   cast (ipi.Number as nvarchar(200))
						   WHEN i.InvoiceID IS NOT NULL THEN
							   cast (i2.Number as nvarchar(200))
						   WHEN i.SaleContractID IS NOT NULL THEN
							   cast (sc2.Number as nvarchar(200))
						   WHEN i.ReturnedSaleInvoiceID IS NOT NULL THEN
							   cast (rsi.Number as nvarchar(200))
						   WHEN i.ReturnInvoiceID IS NOT NULL THEN
							   cast (ri.Number as nvarchar(200))
						   WHEN i.CalculationResultID IS NOT NULL THEN
							   CAST(cal.[Year] AS NVARCHAR(100)) + ''/'' + cm.[MonthName]	
						   ELSE
							   NULL
					   END  AS DocumentNumber,
					   CAST(
						   CASE 
								WHEN ManualReceiptType =1 THEN N''دریافتی''
								ELSE N'' پرداختی''
						   END AS NVARCHAR(512)
					   )  AS ManualReceiptTypeString,
					   CAST(
						   CASE ManualReceiptSubject
								WHEN 1 THEN N''فاکتور خرید''
								WHEN 2 THEN N''برگشت از فروش''
								WHEN 3 THEN N''حقوق''
								WHEN 4 THEN N''اقساط پرداختنی''
								WHEN 5 THEN N''فاکتور''
								WHEN 6 THEN N''اقساط دریافتنی ''
								WHEN 7 THEN N''برگشت از خرید''
								WHEN 8 THEN N''قرارداد فروش''
								ELSE ''''
						   END AS NVARCHAR(512)
					   )  AS ManualReceiptSubjectString
	           FROM   CFG.ManualReceipt i
						join cfg.[user] u1 on u1.UserID = i.Creator
						join cfg.[user] u2 on u2.UserID = i.LastEditor
						LEFT JOIN VND.PurchaseInvoice AS pi
							ON pi.PurchaseInvoiceID = i.PurchaseInvoiceID
						LEFT JOIN CFG.InstallmentPaymentItem AS ipi
							ON ipi.InstallmentPaymentItemID = i.InstallmentPaymentItemID
						LEFT JOIN SLE.Invoice AS i2
							ON i2.InvoiceID = i.InvoiceID
						LEFT JOIN SLE.SaleContract AS sc2
							ON sc2.SaleContractID = i.SaleContractID
						LEFT JOIN SLE.ReturnedSaleInvoice AS rsi
							ON rsi.ReturnedSaleInvoiceID = i.ReturnedSaleInvoiceID
						LEFT JOIN VND.ReturnInvoice AS ri
							ON ri.ReturnInvoiceID = i.ReturnInvoiceID
						LEFT JOIN PAY.CalculationResult AS cr
							ON cr.CalculationResultID = i.CalculationResultID
						LEFT JOIN PAY.CalculationPersonel cp
							ON cr.CalculationPersonelID = cp.CalculationPersonelID
						LEFT JOIN PAY.CalculationType ct
							ON cp.CalculationTypeID = ct.CalculationTypeID
						LEFT JOIN HRM.CalendarMonth cm
							ON cp.CalendarMonthID = cm.CalendarMonthID
						LEFT JOIN HRM.Calendar cal
							ON cm.CalendarID = cal.CalendarID		
					  inner join cfg.Currency c on c.CurrencyId=i.CurrencyID
					  INNER JOIN cfg.Party AS p ON p.PartyID = i.PartyID
					  INNER JOIN ACC.DL AS d ON d.DLID = p.DlID
					  Inner join Cfg.Branch on cfg.Branch.BranchID=i.BranchID
					  INNER JOIN #vwBranchAccess AS vba ON vba.BranchID = i.BranchID
	           WHERE  (i.FinancialPeriodID = @FinancialPeriodID)
					AND (
	                    @UserID = -1
	                    OR (@ViewRelatedToUser IS NOT NULL AND i.Creator = @UserID)
	                    OR (@ViewRelatedToOthers IS NOT NULL AND i.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst)
	                )
	            )		
			)
	    ';
	
	
	DECLARE @selectQuery NVARCHAR(MAX);
	
	IF @Filter IS NULL
	   OR @Filter = ''
	    SET @Filter = '';
	ELSE
	SET @Filter = 'Where (' + @Filter + ')';
	
	
	DECLARE @tableName VARCHAR(100);
	SET @tableName = CFG.getTempTableName(1);
	
	
	
	SET @Query = CFG.ApplyPaging(
	        @tableName,
	        @Query,
	        @PageNumber,
	        @RowspPage,
	        @Filter,
	        @Sort
	    );
	--PRINT @Query
	PRINT @Query;
	EXECUTE sp_executesql @Query,
	     N'
		 @dateFormat varchar(10),
		 @dateType int,
		 @ViewRelatedToOthers NVARCHAR(MAX),
		 @UnauthorizedUsers NVARCHAR(MAX),
		 @FinancialPeriodID int,
		 @UserID int ,
		 @ViewRelatedToUser int   
		 ',
	     @DateType = @DateType,
	     @FinancialPeriodID = @FinancialPeriodID,
	     @DateFormat = @DateFormat,
	     @ViewRelatedToUser = @ViewRelatedToUser,
	     @ViewRelatedToOthers = @ViewRelatedToOthers,
	     @UnauthorizedUsers = @UnauthorizedUsers,
	     @UserID = @UserID;
	    	
	DECLARE @Count INT;
		
	EXEC ('select * from ' + @tableName + ' ORDER BY _RN');
	
	SET @Query = 'select top 1 @Count=  r_count from ' + @tableName; 
	EXECUTE sp_executesql @Query,
	     N'@count int out',
	     @Count = @Count OUT;
	
	RETURN ISNULL(@Count, 0);
	

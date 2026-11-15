
CREATE   PROCEDURE [FOS].GetProformaInvoiceList
(
    @FinancialPeriodID     INT,
    @PageNumber            INT,
    @RowspPage             INT,
    @Sort                  NVARCHAR(MAX) = NULL,
    @Filter                NVARCHAR(MAX) = NULL
)
--WITH ENCRYPTION
AS
	DECLARE @UserID                  INT,
	        @DateType                TINYINT,
	        @DateFormat              VARCHAR(10),	                
	        @ViewRelatedToUser       INT,
	        @ViewRelatedToOthers     NVARCHAR(MAX),
	        @Culture                 VARCHAR(25),		
	        @Submit                  NVARCHAR(100),
			@Confirm                 NVARCHAR(100),
			@Modify                  NVARCHAR(100),
			@Finished                  NVARCHAR(100),
			@PurchaseRequest         NVARCHAR(100),
			@Proposal                NVARCHAR(100),
			@NoBase                  NVARCHAR(100),
            @UnauthorizedUsers NVARCHAR(MAX);
	
	SET @UserID = cfg.GetuserID()
	SET @Culture = cfg.GetuserCulture()
	
	SELECT @DateType = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Type'
	       AND us.UserID = @UserID
	
	IF @DateType IS NULL
	    SET @DateType = CASE @Culture
	                         WHEN 'fa' THEN 0
	                         WHEN 'en' THEN 1
	                         WHEN 'ar' THEN 2
	                    END
	
	SELECT @DateFormat = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Format'
	       AND us.UserID = @UserID
	
	IF @DateFormat IS NULL
	    SET @DATEFORMAT = 'YY/MM/DD'
	
	
	SELECT @Submit = LV.Value
	FROM   cfg.LocalizeEnum L
	       JOIN cfg.LocalizeEnumValue LV
	            ON  L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE  L.Enum = 'ProformaInvoiceStatuses'
	       AND L.Item = 'Submit'
	       AND LV.Culture = @Culture

	SELECT @Confirm = LV.Value
	FROM   cfg.LocalizeEnum L
	       JOIN cfg.LocalizeEnumValue LV
	            ON  L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE  L.Enum = 'ProformaInvoiceStatuses'
	       AND L.Item = 'Confirm'
	       AND LV.Culture = @Culture

	SELECT @Modify = LV.Value
	FROM   cfg.LocalizeEnum L
	       JOIN cfg.LocalizeEnumValue LV
	            ON  L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE  L.Enum = 'ProformaInvoiceStatuses'
	       AND L.Item = 'Modify'
	       AND LV.Culture = @Culture

	SELECT @Finished = LV.Value
	FROM   cfg.LocalizeEnum L
	       JOIN cfg.LocalizeEnumValue LV
	            ON  L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE  L.Enum = 'ProformaInvoiceStatuses'
	       AND L.Item = 'Finished'
	       AND LV.Culture = @Culture

	SELECT @PurchaseRequest = LV.Value
	FROM   cfg.LocalizeEnum L
	       JOIN cfg.LocalizeEnumValue LV
	            ON  L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE  L.Enum = 'ProformaInvoiceBases'
	       AND L.Item = 'PurchaseRequest'
	       AND LV.Culture = @Culture

	SELECT @Proposal = LV.Value
	FROM   cfg.LocalizeEnum L
	       JOIN cfg.LocalizeEnumValue LV
	            ON  L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE  L.Enum = 'ProformaInvoiceBases'
	       AND L.Item = 'Proposal'
	       AND LV.Culture = @Culture

	SELECT @NoBase = LV.Value
	FROM   cfg.LocalizeEnum L
	       JOIN cfg.LocalizeEnumValue LV
	            ON  L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE  L.Enum = 'ProformaInvoiceBases'
	       AND L.Item = 'NoBase'
	       AND LV.Culture = @Culture

	SELECT @ViewRelatedToUser = UserID
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'ProformaInvoice'
		  AND AccessKey = 'ViewRelatedToUser'
		  AND UserID = @UserID;

	SELECT @ViewRelatedToOthers = UserID ,
           @UnauthorizedUsers = Users
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'ProformaInvoice'
		  AND AccessKey = 'ViewRelatedToOthers'
		  AND UserID = @UserID;
		
	IF @Sort IS NULL OR @Sort=''
		SET @Sort='Number'

	DECLARE @Query NVARCHAR(MAX)    
	SET @Query = 
	    'WITH Query_Result 
			(ProformaInvoiceID,
		     FinancialPeriodID,
			 BranchID, 
			 BranchCode,
			 BranchName,
			 BranchName2,
			 Base,
			 BaseString,
			 Number,
		     [Date],
			 Date_Date,
			 CreditDate,
			 Date_CreditDate,
		     Vendor,
		     VendorCode,
			 VendorName,
			 VendorName2,
			 CurrencyID,
			 CurrencyName,
			 CurrencyName2,
			 DLID,
			 DlCode,
			 DlTitle,
			 DlTitle2,
			 Status,
			 StatusString,			
			 [Version], 
			 Creator,
			 CreationDate,
			 LastEditor,
			 LastEditionDate,			
			 CreateDateString,
			 EditionDateString,
			 CreatorUserName,
			 EditorName)
			AS (
		 SELECT p.ProformaInvoiceID,
				p.FinancialPeriodID,
				p.BranchID, 
				b.Code BranchCode,
				b.Title BranchName,
				b.Title2 BranchName2,
				p.Base,
				baseEnum.Value BaseString,
				p.Number,
				p.[Date],
				CFG.GetCLRSaturnDate(p.[Date], @DateFormat , 0, @DateType) AS Date_Date,
				p.CreditDate,
				CFG.GetCLRSaturnDate(p.CreditDate, @DateFormat , 0, @DateType) AS Date_CreditDate,
				p.Vendor,
				dl.Code VendorCode,
				CAST(CASE WHEN pa.[Type] = 1 or pa.[Type] = 2 THEN pa.Title
						  WHEN pa.[Type] = 0 THEN pa.Title+'' ''+pa.LastName
				END AS NVARCHAR(512)) VendorName,
				CAST(CASE WHEN pa.[Type] = 1 or pa.[Type] = 2 THEN pa.Title2
						  WHEN pa.[Type] = 0 THEN pa.Title2+'' ''+pa.LastName2
				END AS NVARCHAR(512)) VendorName2,
				p.CurrencyID,
				c.Title CurrencyName,
				c.Title2 CurrencyName2,			
				p.DLID,
				d.Code DlCode,
				d.Title DlTitle,
				d.Title2 DlTitle2,
				p.Status,
				case when p.Status = 1 then @Submit
				     when p.Status = 2 then @Confirm
					 when p.Status = 3 then @Modify
					 ELSE @Finished
				end StatusString,
				p.[Version], 
				p.Creator,
				p.CreationDate,		
				p.LastEditor,
				p.LastEditionDate,
				CFG.GetCLRSaturnDate(p.CreationDate, @DateFormat , 1, @DateType) AS CreateDateString, 
				CFG.GetCLRSaturnDate(p.LastEditionDate, @DateFormat , 1, @DateType) AS EditionDateString,
				u.[Name] AS CreatorUserName,
				u2.[Name] AS EditorName

		FROM FOS.ProformaInvoice p
			JOIN CFG.Branch b ON b.BranchID = p.BranchID
			JOIN CFG.Party pa ON pa.PartyID = p.Vendor
			LEFT JOIN ACC.DL dl ON pa.DlID = dl.DLID
			JOIN CFG.Currency c ON p.CurrencyID = c.CurrencyID
			JOIN ACC.DL d ON d.DLID = p.DLID
			JOIN CFG.[User] u ON u.UserID = p.Creator
			JOIN CFG.[User] u2 ON u2.UserID = p.LastEditor
			INNER JOIN cfg.vwBranchAccess AS vba ON vba.BranchID = p.BranchID
			LEFT OUTER JOIN CFG.vwEnums baseEnum on  baseEnum.Enum = ''ProformaInvoiceBases'' and baseEnum.KeyValue = p.Base
		WHERE (p.FinancialPeriodID = @FinancialPeriodID)
			and (@UserID = -1 
			or  (@ViewRelatedToUser is not null and p.Creator = @UserID)
			or  (@ViewRelatedToOthers IS NOT NULL AND p.Creator not in (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst)))
		)'


	DECLARE @selectQuery NVARCHAR(MAX)
	
	IF @Filter IS NULL
	   OR @Filter = ''
	    SET @Filter = ''
	ELSE
	    SET @Filter = 'Where (' + @Filter + ')'
	
	
	DECLARE @tableName VARCHAR(100)
	SET @tableName = cfg.getTempTableName(1)
	
	
	SET @Query = Cfg.ApplyPaging (
	        @tableName,
	        @Query,
	        @PageNumber,
	        @RowspPage,
	        @Filter,
	        @Sort
	    )
	
	EXECUTE sp_executesql @Query,
	     N'@FinancialPeriodID       INT,
		   @UserID                  INT,
	       @DateType                TINYINT,
	       @DateFormat              VARCHAR(10),	                
	       @ViewRelatedToUser       INT,
	       @ViewRelatedToOthers     NVARCHAR(MAX),
	       @UnauthorizedUsers	    NVARCHAR(MAX),
	       @Culture                 VARCHAR(25),		
	       @Submit                  NVARCHAR(100),
		   @Confirm                 NVARCHAR(100),
		   @Modify                  NVARCHAR(100),
		   @Finished                  NVARCHAR(100),
		   @PurchaseRequest         NVARCHAR(100),
		   @Proposal                NVARCHAR(100),
		   @NoBase                  NVARCHAR(100)',
		   @FinancialPeriodID = @FinancialPeriodID,
		   @UserID = @UserID,
		   @DateType = @DateType,
		   @DateFormat = @DateFormat,
		   @ViewRelatedToUser = @ViewRelatedToUser,
		   @ViewRelatedToOthers = @ViewRelatedToOthers,
		   @UnauthorizedUsers = @UnauthorizedUsers,
		   @Culture = @Culture,
		   @Submit = @Submit,
		   @Confirm = @Confirm,
		   @Modify = @Modify,
		   @Finished = @Finished,
		   @PurchaseRequest = @PurchaseRequest,
		   @Proposal = @Proposal,
		   @NoBase = @NoBase

	DECLARE @Count INT
	
	
	EXEC ('select * from ' + @tableName +' ORDER BY _RN');
	
	SET @Query = 'select top 1 @Count=  r_count from ' + @tableName 
	EXECUTE sp_executesql @Query,
	     N'@count int out',
	     @Count = @Count OUT
	
	RETURN ISNULL(@Count, 0)


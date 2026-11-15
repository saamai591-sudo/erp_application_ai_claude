
CREATE   PROCEDURE [SLE].GetInvoiceList
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
			@Culture                 VARCHAR(10),
			@UnauthorizedUsers		 NVARCHAR(MAX);


	select * into #vwBranchAccess 
	from cfg.vwBranchAccess

	select * into #vwSaleAreaAccess 
	from cfg.vwSaleAreaAccess

	select * into #vwPartyAccess 
	from cfg.vwPartyAccess

	
	SET @Culture = CFG.GetuserCulture();
		   
	SELECT * into #vwEnum 
	FROM   cfg.VwEnums AS ve
	WHERE ve.Enum IN( 'SaleDocumentBases','Status','DocumentStatus','TradeType')

	
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
	WHERE EntityName = 'Invoice'
		  AND AccessKey = 'ViewRelatedToUser'
		  AND UserID = @UserID;

	SELECT @ViewRelatedToOthers = UserID ,
		   @UnauthorizedUsers = Users
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'Invoice'
		  AND AccessKey = 'ViewRelatedToOthers'
		  AND UserID = @UserID;

	IF @Sort IS NULL
	   OR @Sort = ''
		SET @Sort = 'Number desc ';

	
	DECLARE @Query NVARCHAR(MAX);    
	SET @Query = 
		'
				select *
				into #Voucher
				from acc.vwVoucherPrevoucher
				where engname = ''Invoice''
				and FinancialPeriodID = @FinancialPeriodID

		;WITH Query_Result 
			(
				InvoiceID ,
				Percentage,
				FinancialPeriodID ,
				BaseDocument ,
				[SaleTypeId] ,
				BranchID ,
				CustomerID ,
				AddressID  ,
				Number ,
				[Date]  ,
				CurrencyID ,
				CurrencyRate  ,
				SaleAgentID  ,
				TotalPrice  ,
				TotalDiscount  ,
				TotalNetPrice  ,
				TotalTax  ,
				TotalDuty  ,
				PreVoucherID  ,
				[SaleInvoiceStatus] ,
				[Version] ,
				Creator ,
				CreationDate  ,
				LastEditionDate,
				BranchName  ,
				BranchName2  ,
				BranchCode ,
				CustomerName  ,
				CustomerName2  ,
				CustomerDlCode  ,
				SaleTypeTitle  ,
				CustomerSubscription  ,
				CurrencyName  ,
				CurrencyName2  ,
				Date_Date  ,
				CreateDateString  ,
				EditionDateString  ,
				CreatorUserName  ,
				EditorName  ,
				VoucherID  ,
				VoucherNumber  ,
				VoucherDate  ,
				Date_VoucherDate  ,
				IsNotInFlow ,
				SaleAgentName  ,
				SaleAgentName2  ,
				PreReceive,
				SaleAreaId,
				ParentInvoiceID,
				ParentInvoiceNumber,
				SaleAreaTitle,
				SaleAreaTitle2,
				StatusString  ,
				BaseDocumentName,
				DocumentStatus,
				DocumentStatusString
			)
			As (
			  SELECT *
				FROM   (
			   SELECT i.InvoiceID,
					  i.Percentage,
					  i.FinancialPeriodID,
					  i.BaseDocument,
					  i.[SaleTypeId],
					  i.BranchID,
					  i.CustomerID,
					  i.AddressID,
					  i.Number,
					  i.[Date],
					  i.CurrencyID,
					  i.CurrencyRate,
					  i.SaleAgentID,
					  i.TotalPrice,
					  i.TotalDiscount,
					  i.TotalNetPrice,
					  i.TotalTax,
					  i.TotalDuty,
					  i.PreVoucherID,
					  i.SaleInvoiceStatus,
					  i.[Version],
					  i.Creator,
					  i.CreationDate,
					  i.LastEditionDate,
					  b.Title  AS BranchName,
					  b.Title2  AS BranchName2,
					  b.Code   AS BranchCode,
					  p.Title + '' '' + ISNULL(p.LastName, '''') AS CustomerName,
					  p.Title2 + '' '' + ISNULL(p.LastName2, '''') AS CustomerName2,
					  d.Code AS CustomerDlCode,
					  sty.Title SaleType,
					  p.CustomerCode AS CustomerSubscription,
					  c.Title AS CurrencyName,
					  c.Title2 AS CurrencyName2,
					  CFG.GetCLRSaturnDate(i.[Date], @DateFormat, 0, @DateType) AS Date_Date,
					  CFG.GetCLRSaturnDate(i.CreationDate, @DateFormat, 1, @DateType) AS CreateDateString,
					  CFG.GetCLRSaturnDate(i.LastEditionDate, @DateFormat, 1, @DateType) AS  EditionDateString,
					  u.Name AS CreatorUserName,
					  u2.Name AS EditorName,
					  vp.VoucherID AS VoucherID,
					  v.ReferenceNumber AS VoucherNumber,
					  v.[Date] AS VoucherDate,
					  CFG.GetCLRSaturnDate(v.[Date], @DateFormat, 0, @DateType) AS Date_VoucherDate,
					  CAST(
						  CASE 
							   WHEN SLE.InvoiceHasFlow(i.InvoiceID) = 0 THEN 1
							   ELSE 0
						  END AS BIT
					  ) AS IsNotInFlow,
					  p2.Title + '' '' + isnull(p2.LastName,'''') AS SaleAgentName,
					  p2.Title2 + '' '' + isnull(p2.LastName2,'''') AS SaleAgentName2,
					  isnull(pre.PreReceive,0) AS PreReceive,
								i.SaleAreaId,
								i.ParentInvoiceID,
								case when ref.ParentInvoiceID is not null then ref.Number else null end as ParentInvoiceNumber,
								sa.Title AS SaleAreaTitle,
								sa.Title2 AS SaleAreaTitle2	,								
								cast(ve2.Value as nvarchar(512)) as StatusString,
								cast(ve.Value as nvarchar(512)) as BaseDocumentName,
								CASE 
				WHEN vp.VoucherID IS NOT NULL AND vp.VoucherID <> 0 THEN CAST(3 AS TINYINT)
				WHEN i.PreVoucherID IS NOT NULL AND i.PreVoucherID <> 0 THEN CAST(2 AS TINYINT)
				ELSE CAST(1 AS TINYINT)	END AS DocumentStatus ,
				cast(ve1.Value as Nvarchar(512)) as 	DocumentStatusString

			   FROM   SLE.Invoice AS i
			   INNER join #vwEnum ve on i.BaseDocument = ve.KeyValue and ve.Enum= ''SaleDocumentBases''
			   join SLE.SaleType sty on sty.SaleTypeId = i.SaleTypeId
			   left join SLE.SaleArea sa on sa.SaleAreaId = i.SaleAreaId
			   left join SLE.Invoice ref on i.ParentInvoiceID = ref.InvoiceID
				LEFT JOIN ( SELECT  ipr.InvoiceID ,
								SUM(ipr.Price) PreReceive
						FROM    SLE.InvoicePreReceive AS ipr
						GROUP BY ipr.InvoiceID
						) pre ON pre.InvoiceID = i.InvoiceID
				INNER JOIN CFG.Branch AS b
					ON  b.BranchID = i.BranchID
				INNER JOIN CFG.Party AS p
					ON  p.PartyID = i.CustomerID
				INNER JOIN CFG.Currency AS c
					ON  c.CurrencyID = i.CurrencyID
				INNER JOIN CFG.[User] AS u
					ON  u.UserID = i.Creator
				INNER JOIN CFG.[User] AS u2
					ON  u2.UserID = i.LastEditor
				LEFT  JOIN ACC.DL AS d
					ON  d.DLID = p.DlID
				LEFT JOIN SLE.SaleAgent sag on sag.SaleAgentID = i.SaleAgentID
				LEFT  JOIN cfg.Party p2
					ON  p2.PartyID = sag.PartyID
				LEFT JOIN  #Voucher vp
					ON  vp.PrevoucherID = i.PreVoucherID
			   INNER join #vwEnum ve1 on Case when i.PrevoucherID is null then 1 when i.PrevoucherID is not null and isnull(vp.VoucherID,0)<> 0 then 1 else 2 end = ve1.KeyValue and ve1.Enum = ''DocumentStatus''
			   INNER join #vwEnum ve2 on i.SaleInvoiceStatus = ve2.KeyValue and ve2.Enum = ''Status''
				LEFT JOIN acc.voucher v
					ON  v.VoucherID = vp.VoucherID
				INNER JOIN #vwBranchAccess vba on i.BranchID=vba.BranchID
				INNER JOIN #vwSaleAreaAccess AS vsaa ON vsaa.SaleAreaID = i.SaleAreaID
				INNER JOIN  #vwPartyAccess AS vpa ON i.CustomerID=vpa.PartyID
			   WHERE  (i.FinancialPeriodID = @FinancialPeriodID)
					AND (
						@UserID = -1
						OR (@ViewRelatedToUser IS NOT NULL AND i.Creator = @UserID)
						OR ( @ViewRelatedToOthers IS NOT NULL AND i.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst) )
					)
		   )T )';
	
	PRINT @Query;
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
	
	EXECUTE sp_executesql @Query,
		 N'
		 @dateFormat varchar(10),
		 @dateType int,
		 @ViewRelatedToOthers NVARCHAR(MAX),
		 @UnauthorizedUsers	  NVARCHAR(MAX),
		 @FinancialPeriodID int,
		 @UserID int,
		 @ViewRelatedToUser int',
		 @DateType = @DateType,
		 @FinancialPeriodID = @FinancialPeriodID,
		 @DateFormat = @DateFormat,
		 @ViewRelatedToUser = @ViewRelatedToUser,
		 @UserID = @UserID,
		 @ViewRelatedToOthers = @ViewRelatedToOthers,
		 @UnauthorizedUsers = @UnauthorizedUsers
		;
	
	DECLARE @Count INT;

	EXEC ('select * from ' + @tableName + ' ORDER BY _RN');
	
	SET @Query = 'select top 1 @Count=  r_count from ' + @tableName; 
	EXECUTE sp_executesql @Query,
		 N'@count int out',
		 @Count = @Count OUT;
	
	RETURN ISNULL(@Count, 0);


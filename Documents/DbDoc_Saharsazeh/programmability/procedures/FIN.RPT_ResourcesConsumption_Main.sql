---------------------------------------------------------------------------------------------------------
CREATE    PROC [FIN].RPT_ResourcesConsumption_Main
(
	@FromDate DATE,
	@ToDate DATE,
	@SelectedBranches VARCHAR(1024) = NULL,
	@SelectedDls VARCHAR(1024) = NULL
)
AS
BEGIN
	DECLARE @Query VARCHAR(MAX),
			@Columns VARCHAR(MAX),
			@SelectColumns VARCHAR(MAX),
			@Culture VARCHAR(25),
			@CultureNo INT,
			@userId INT;
			
			
			SELECT VALUE BranchID into #SelectedBranch
			 FROM CFG.R_FnCommaStr2Table(@SelectedBranches)
			
		SELECT * into #vwBranchAccess
		FROM cfg.vwBranchAccess AS vba
		
	 SELECT vba.* into #BranchAccess
	 FROM #vwBranchAccess AS vba
	 left join #SelectedBranch AS sb on vba.BranchID = sb.BranchID
	 WHERE (@SelectedBranches is NULL or sb.BranchID is NOT NULL) 
			
			

	SET @Culture = CFG.GetuserCulture();

	SET @userId = CFG.GetuserID();

	SELECT @CultureNo = CultureNo
	FROM CFG.CultureInfo
	WHERE Culture = @Culture;

	IF OBJECT_ID('tempdb..#FilteredDlTypes') IS NOT NULL
		DROP TABLE #FilteredDlTypes;

	CREATE TABLE #FilteredDlTypes
	(
		DlTypeID INT,
		DlID INT
	);

	IF (@SelectedDls IS NOT NULL AND @SelectedDls <> '')
	BEGIN

		SELECT @SelectedDls 
			= STUFF(
		(
			SELECT ',' + [CFG].[GetStringPartBySpliter](value, 1, '#') + '#'
				   + REPLACE(
								[CFG].[GetStringPartBySpliter](value, 2, '#'),
								',',
								',' + [CFG].[GetStringPartBySpliter](value, 1, '#') + '#'
							)
			FROM [CFG].[Split](@SelectedDls, '|')
			FOR XML PATH(''), TYPE
		).value('.', 'NVARCHAR(MAX)'),
		1   ,
		1   ,
		''
				   );

		INSERT INTO #FilteredDlTypes
		SELECT [CFG].[GetStringPartBySpliter](value, 1, '#'),
			   [CFG].[GetStringPartBySpliter](value, 2, '#')
		FROM [CFG].[Split](@SelectedDls, ',');

	END;


	CREATE TABLE #RPT_ResourcesConsumption_Main
	(
		ID VARCHAR(250),
		[Type] NVARCHAR(500),
		[Rno] INT,
		DocumentType NVARCHAR(250),
		CurrencyID INT,
		Amount DECIMAL(30, 4),
		[Subject] INT,
		AffectedInVat bit
	);

	INSERT INTO #RPT_ResourcesConsumption_Main
	SELECT '0*',
		   NULL,
		   0,
		   'اول دوره',
		   CurrencyID,
		   SUM(Amount) amount,
		   NULL,
		   0 AffectedInVat
	FROM
	(
		SELECT CurrencyID,
			   Amount
		FROM FIN.vwbankaccount vw
		WHERE Date < @FromDate
			  AND
			  vw.BranchID IN (SELECT ba.BranchID FROM #BranchAccess ba)
			  
			  
		UNION ALL
		
		SELECT vw.CurrencyID,
			   Amount
		FROM FIN.VWCash vw
		join cfg.Cash c on c.CashID = vw.CashID
		WHERE (Date is null or Date < @FromDate)
			  AND
			  BranchID IN (SELECT ba.BranchID FROM #BranchAccess ba)
			  AND c.IsActive = 1
		UNION ALL
		
		SELECT CurrencyID,
			   Amount
		FROM FIN.VWPettyCash vw
		WHERE (Date is null or Date < @FromDate)
			  AND         BranchID IN (SELECT ba.BranchID FROM #BranchAccess ba)
	) F
	WHERE @SelectedDls IS NULL
	GROUP BY CurrencyID;


	INSERT INTO #RPT_ResourcesConsumption_Main
	SELECT '1*',
		   VW.Type,
		   1,
		   'دریافت از مشتریان',
		   VW.CurrencyID,
		   SUM(VW.Amount),
		   NULL,
		   0 AS AffectedInVat
	FROM FIN.VWResourcesConsumption VW
	WHERE (
			  DocumentType = 'FromCustomers'
			  OR
			  (
				  VW.Type = 'Receive'
				  AND SubjectType IN ( 1, 2 )
			  )
		  )
		  AND Date
		  BETWEEN @FromDate AND @ToDate
		  AND BranchID IN (SELECT ba.BranchID FROM #BranchAccess ba)
	GROUP BY VW.CurrencyID,
			 VW.Type
			 --,AffectedInVat


	INSERT INTO #RPT_ResourcesConsumption_Main
	SELECT '2*' + CAST(VW.SubjectTypeID AS VARCHAR(25)),
		   VW.Type,
		   2,
		   CASE
			   WHEN @CultureNo = 1 THEN
				   SubjectTitle
			   WHEN @CultureNo = 2 THEN
				   SubjectTitle2
		   END Title,
		   VW.CurrencyID,
		   SUM(VW.Amount),
		   VW.SubjectTypeID,
		   0 AS AffectedInVat
	FROM FIN.VWResourcesConsumption VW
	WHERE VW.Type = 'Receive'
		  AND SubjectType NOT IN ( 1, 2 )
		  AND Date
		  BETWEEN @FromDate AND @ToDate
		  AND BranchID IN (SELECT ba.BranchID FROM #BranchAccess ba)
	GROUP BY SubjectTitle,
			 SubjectTitle2,
			 VW.CurrencyID,
			 VW.SubjectTypeID,
			 VW.Type
			-- ,AffectedInVat


	INSERT INTO #RPT_ResourcesConsumption_Main
	SELECT '3*',
		   VW.Type,
		   3,
		   'تبدیل ارز',
		   VW.CurrencyID,
		   SUM(VW.Amount),
		   NULL,
		   0 AS AffectedInVat
	FROM FIN.VWResourcesConsumption VW
	WHERE DocumentType = 'Change'
		  AND Amount > 0
		  AND Date
		  BETWEEN @FromDate AND @ToDate
		  AND BranchID IN (SELECT ba.BranchID FROM #BranchAccess ba)
	GROUP BY VW.CurrencyID,
			 VW.Type
			 --,AffectedInVat


	INSERT INTO #RPT_ResourcesConsumption_Main
	SELECT '4*',
		   VW.Type,
		   4,
		   'پرداخت به تامین کنندگان',
		   VW.CurrencyID,
		   SUM(VW.Amount),
		   NULL,
		   0 AS AffectedInVat
	FROM FIN.VWResourcesConsumption VW
	WHERE VW.Type = 'Payment'
		  AND SubjectType IN ( 1, 10 )
		  AND Date
		  BETWEEN @FromDate AND @ToDate
		  AND BranchID IN (SELECT ba.BranchID FROM #BranchAccess ba)
	GROUP BY VW.CurrencyID,
			 VW.Type
			 --,AffectedInVat


	INSERT INTO #RPT_ResourcesConsumption_Main
	SELECT '5*' + CAST(VW.SubjectTypeID AS VARCHAR(25)),
		   VW.Type,
		   5,
		   CASE
			   WHEN @CultureNo = 1 THEN
				   SubjectTitle
			   WHEN @CultureNo = 2 THEN
				   SubjectTitle2
		   END Title,
		   VW.CurrencyID,
		   SUM(VW.Amount),
		   VW.SubjectTypeID,
		   0 AS AffectedInVat
	FROM FIN.VWResourcesConsumption VW
	WHERE Date
		  BETWEEN @FromDate AND @ToDate
		  AND VW.Type = 'Payment'
		  AND SubjectType NOT IN ( 1, 4, 5, 6, 10 )
		  AND BranchID IN (SELECT ba.BranchID FROM #BranchAccess ba)
	GROUP BY SubjectTitle,
			 SubjectTitle2,
			 VW.CurrencyID,
			 VW.SubjectTypeID,
			 VW.Type
			 --,AffectedInVat


	INSERT INTO #RPT_ResourcesConsumption_Main
	SELECT '6*',
		   VW.Type,
		   6,
		   'تبدیل ارز',
		   VW.CurrencyID,
		   SUM(VW.Amount),
		   NULL,
		   0 AS AffectedInVat
	FROM FIN.VWResourcesConsumption VW
	WHERE DocumentType = 'Change'
		  AND Amount < 0
		  AND Date
		  BETWEEN @FromDate AND @ToDate
		  AND BranchID IN (SELECT ba.BranchID FROM #BranchAccess ba)
	GROUP BY VW.CurrencyID,
			 VW.Type
			--, AffectedInVat


	INSERT INTO #RPT_ResourcesConsumption_Main
	SELECT '7*',
		   VW.Type,
		   7,
		   N'کارمزد',
		   VW.CurrencyID,
		   SUM(VW.Amount),
		   NULL,
		   0 AS AffectedInVat
	FROM FIN.VWResourcesConsumption VW
	WHERE DocumentType = 'Wage'
		  AND Date BETWEEN @FromDate AND @ToDate
		  AND BranchID IN (SELECT ba.BranchID FROM #BranchAccess ba)
	GROUP BY VW.CurrencyID,
			 VW.Type
			-- ,AffectedInVat


	SELECT @Columns = STUFF(
	(
		SELECT DISTINCT
			   ',' + QUOTENAME(CurrencyID)
		FROM CFG.Currency
		FOR XML PATH(''), TYPE
	).value('.', 'NVARCHAR(MAX)'),
	1   ,
	1   ,
	''
						   );

	SELECT @SelectColumns = STUFF(
	(
		SELECT DISTINCT
			   ',' + QUOTENAME(CurrencyID) + ' T' + CASE CurrencyID
														WHEN -1 THEN
															'0'
														ELSE
															CAST(CurrencyID AS VARCHAR(50))
													END
		FROM CFG.Currency
		FOR XML PATH(''), TYPE
	).value('.', 'NVARCHAR(MAX)'),
	1   ,
	1   ,
	''
								 );


	SET @Query
		= N'
		select [ID],case when [Type] is null then N''اول دوره''
						 when [Type] = ''Receive'' then N''منبع''
						 when [Type] = ''Payment'' then N''مصرف'' end [Type],AffectedInVat,
			   Rno,DocumentType,[Subject],' + @SelectColumns
		  + '  from
		(select * from #RPT_ResourcesConsumption_Main)X
		pivot
		(
		avg(amount)
		for CurrencyID in (' + @Columns + ')
		) P
		order by rno';

	EXEC (@Query);

END;

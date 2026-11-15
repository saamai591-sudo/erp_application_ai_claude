
CREATE   PROCEDURE STM.RptCover
(
	@GlVoucherIDs VARCHAR(MAX) = NULL,
	@VoucherIds VARCHAR(MAX) = NULL,
	@FromDate DATE = NULL,
	@ToDate DATE = NULL
)
--WITH ENCRYPTION 
AS
BEGIN

	DECLARE @Columns NVARCHAR(MAX),
			@SelectQuery2 NVARCHAR(MAX),
			@CultureNo INT,
			@Culture NVARCHAR(10),
			@Record NVARCHAR(100),
			@Note NVARCHAR(100),
			@Survey NVARCHAR(100),
			@Confirm NVARCHAR(100),
			@DateType INT,
			@DATEFORMAT VARCHAR(50),
			@userId INT;

	SET @Culture = CFG.GetuserCulture();
	SET @userId = CFG.GetuserID();

	SELECT @CultureNo = CultureNo
	FROM CFG.CultureInfo
	WHERE Culture = @Culture;

	SELECT @DateType = us.SettingValue
	FROM CFG.UserSetting us
	WHERE us.SettingKey = 'Date_Type'
		  AND us.UserID = @userId;

	IF @DateType IS NULL
		SET @DateType = CASE @Culture
							WHEN 'fa' THEN
								0
							WHEN 'en' THEN
								1
							ELSE
								2
						END;

	SELECT @DATEFORMAT = us.SettingValue
	FROM CFG.UserSetting us
	WHERE us.SettingKey = 'Date_Format'
		  AND us.UserID = @userId;


	SELECT @Record = LEV.Value
	FROM CFG.LocalizeEnumValue LEV
		INNER JOIN CFG.LocalizeEnum LE
			ON LE.LocalizeEnumID = LEV.LocalizeEnumID
	WHERE LE.Enum = 'VoucherStatuses'
		  AND LE.Item = 'Record'
		  AND LEV.Culture = @Culture;

	SELECT @Note = LEV.Value
	FROM CFG.LocalizeEnumValue LEV
		INNER JOIN CFG.LocalizeEnum LE
			ON LE.LocalizeEnumID = LEV.LocalizeEnumID
	WHERE LE.Enum = 'VoucherStatuses'
		  AND LE.Item = 'Note'
		  AND LEV.Culture = @Culture;

	SELECT @Survey = LEV.Value
	FROM CFG.LocalizeEnumValue LEV
		INNER JOIN CFG.LocalizeEnum LE
			ON LE.LocalizeEnumID = LEV.LocalizeEnumID
	WHERE LE.Enum = 'VoucherStatuses'
		  AND LE.Item = 'Survey'
		  AND LEV.Culture = @Culture;

	SELECT @Confirm = LEV.Value
	FROM CFG.LocalizeEnumValue LEV
		INNER JOIN CFG.LocalizeEnum LE
			ON LE.LocalizeEnumID = LEV.LocalizeEnumID
	WHERE LE.Enum = 'VoucherStatuses'
		  AND LE.Item = 'Confirm'
		  AND LEV.Culture = @Culture;

	IF @DATEFORMAT IS NULL
		SET @DATEFORMAT = 'YY/MM/DD';

	CREATE TABLE #selVouchers
	(
		GlVoucherID INT,
		VoucherID INT,
		Position INT
	);

	IF (@GlVoucherIDs IS NOT NULL)
	BEGIN

		INSERT INTO #selVouchers
		(
			GlVoucherID,
			VoucherID,
			Position
		)
		SELECT gi.GIVoucherID,
			   gi.VoucherID,
			   0
		FROM ACC.GIVoucherItem AS gi
		WHERE  EXISTS
			  (
				  SELECT f.value FROM CFG.R_FnCommaStr2Table(@GlVoucherIDs) f
				  WHERE f.value = gi.GIVoucherID
			  );

	END;
	ELSE
	BEGIN
		INSERT INTO #selVouchers
		(
			GlVoucherID,
			VoucherID,
			Position
		)
		SELECT NULL,
			   f.value,
			   f.Position
		FROM CFG.R_FnCommaStr2Table(@VoucherIds) f;
	END;



	SELECT CAST(ROW_NUMBER() OVER (ORDER BY al.AccountLevelID) AS VARCHAR(2)) AS AccountLevelIndex,
		   CAST(al.AccountLevelID AS VARCHAR(50)) AS AccountLevelID,
		   al.Title,
		   al.AccountLevelTypeID
	INTO #T2
	FROM ACC.AccountLevel al
	WHERE al.AccountLevelTypeID = 1;

	SELECT CASE
			   WHEN g.Number IS NULL THEN
				   v.Number
			   ELSE
				   g.Number
		   END number,
		   CAST(ROW_NUMBER() OVER (ORDER BY v.Position, v.Number, vi.VoucherItemIndex) AS INT) AS Rno,
		   CAST(RANK() OVER (ORDER BY v.Position, v.Number) AS INT) AS OrderView,
		   CFG.GetCLRSaturnDate(   CASE
									   WHEN g.Date IS NULL THEN
										   v.Date
									   ELSE
										   g.Date
								   END,
								   UPPER(@DATEFORMAT),
								   @DateType,
								   0
							   ) AS [Column],
		   CASE
			   WHEN @CultureNo = 1 THEN
				   v.Description
			   ELSE
				   v.Description2
		   END description,
		   CASE
			   WHEN g.GlVoucherID IS NULL THEN
				   v.VoucherID
			   ELSE
				   g.GlVoucherID
		   END VoucherId,
		   v.ReferenceNumber,
		   v.SubNumber,
		   v.DailyNumber,
		   v.BranchID,
		   CASE
			   WHEN @CultureNo = 1 THEN
				   vi.Description
			   ELSE
				   vi.Description2
		   END AS ItemDescription,
		   vi.Debit,
		   vi.Credit,
		   vi.CurrencyDebit,
		   vi.CurrencyCredit,
		   CASE
			   WHEN g.Date IS NULL THEN
				   v.Date
			   ELSE
				   g.Date
		   END Date,
		   CASE
			   WHEN vi.Debit > vi.Credit THEN
				   vi.Debit
			   ELSE
				   1 * vi.Credit
		   END AS Mablagh,
		   CASE
			   WHEN vi.Debit > vi.Credit THEN
				   -1
			   ELSE
				   1
		   END AS BedoBes,
		   CASE
			   WHEN vi.Debit > vi.Credit THEN
				   '-'
			   ELSE
				   ''
		   END + CAST(ACC.SlFullCode(s.SlID) AS VARCHAR(20)) AS FullCode2,
		   CASE
			   WHEN vi.Debit > vi.Credit THEN
				   '-'
			   ELSE
				   ''
		   END + CAST(ACC.SlFullCode(s2.SlID) AS VARCHAR(20)) AS GLFullCode2,
		   ACC.SlFullCode(s.SlID) AS FullCode,
		   ACC.SlFullCode(s2.SlID) AS GLFullCode,
		   CASE
			   WHEN @CultureNo = 1 THEN
				   s.Title
			   ELSE
				   s.Title2
		   END Title,
		   vi.VoucherItemID,
		   vi.CurrencyID,
		   CASE
			   WHEN @CultureNo = 1 THEN
				   cu.Title
			   ELSE
				   cu.Title2
		   END CurrencyTitle,
		   vi.CurrencyRate,
		   vi.VoucherItemIndex,
		   s.SlID * CASE
						WHEN vi.Debit > vi.Credit THEN
							1
						ELSE
							-1
					END AS MoeenSlid,
		   CASE
			   WHEN @CultureNo = 1 THEN
				   s.Title
			   ELSE
				   s.Title2
		   END AS MoeenTitle,
		   s.Code AS MooenCode,
		   s2.SlID * CASE
						 WHEN vi.Debit > vi.Credit THEN
							 1
						 ELSE
							 -1
					 END AS GlSlid,
		   CASE
			   WHEN @CultureNo = 1 THEN
				   s2.Title
			   ELSE
				   s2.Title2
		   END AS GlTitle,
		   s2.Code AS GlCode,
		   CASE v.VoucherStatusID
			   WHEN 1 THEN
				   @Record
			   WHEN 2 THEN
				   @Note
			   WHEN 3 THEN
				   @Survey
			   ELSE
				   @Confirm
		   END AS StatusName,
		   CASE
			   WHEN @CultureNo = 1 THEN
				   u.Name
			   ELSE
				   u.Name2
		   END AS UserTitle,
		   CASE
			   WHEN @CultureNo = 1 THEN
				   b.Title
			   ELSE
				   b.Title2
		   END BranchTitle,
			CASE
			   WHEN @CultureNo = 1 THEN
				   cmp.Title
			   ELSE
				   cmp.Title2
		   END CompanyTitle,
		   CASE
			   WHEN @CultureNo = 1 THEN
				   u2.Name
			   ELSE
				   u2.Name2
		   END Reviewer,
		   CASE
			   WHEN @CultureNo = 1 THEN
				   u3.Name
			   ELSE
				   u3.Name2
		   END Corroborator
	INTO #T
	FROM
	(
		SELECT v.VoucherID,
			   v.BranchID,
			   v.Number,
			   v.ReferenceNumber,
			   v.DailyNumber,
			   v.SubNumber,
			   v.Date,
			   v.VoucherStatusID,
			   v.Description,
			   v.Description2,
			   v.Creator,
			   v.Reviewer,
			   v.Corroborator,
			   s.GlVoucherID,
			   s.Position
		FROM ACC.Voucher v
			INNER JOIN #selVouchers s
				ON v.VoucherID = s.VoucherID
		WHERE (
				  @FromDate IS NULL
				  OR v.Date >= @FromDate
			  )
			  AND
			  (
				  @ToDate IS NULL
				  OR v.Date <= @ToDate
			  )
	) v
		INNER JOIN ACC.VoucherItem vi
			ON vi.VoucherID = v.VoucherID
		INNER JOIN CFG.Branch b
			ON v.BranchID = b.BranchID
		INNER JOIN cfg.Company cmp on b.CompanyID = cmp.CompanyID
		INNER JOIN CFG.Currency cu
			ON cu.CurrencyID = vi.CurrencyID
		INNER JOIN ACC.SL s
			ON s.SlID = vi.SlID
		INNER JOIN ACC.SL s2
			ON s2.SlID = ACC.SlKolId(s.SlID)
		INNER JOIN CFG.[User] u
			ON u.UserID = v.Creator
		LEFT JOIN ACC.GIVoucher g
			ON v.GlVoucherID = g.GlVoucherID
		LEFT JOIN CFG.[User] u2
			ON u2.UserID = v.Reviewer
		LEFT JOIN CFG.[User] u3
			ON u3.UserID = v.Corroborator;


	DECLARE @I INT,
			@SelectQuery NVARCHAR(MAX),
			@JoinQuery NVARCHAR(MAX),
			@Query NVARCHAR(MAX),
			@SelectQueryAllDl NVARCHAR(MAX),
			@IStr NVARCHAR(10);



	SELECT @SelectQuery = STUFF(
	(
		SELECT DISTINCT
			   ', DL' +  
			   CAST(al.AccountLevelID AS VARCHAR(10)) + 
			   N'.Code as AL_' + CAST(al.AccountLevelID AS VARCHAR(10)) + 
			   N' ,DL' + CAST(al.AccountLevelID AS VARCHAR(10)) +
			   CASE
					WHEN @CultureNo = 1 THEN
						'.Title as ALTITLE_'
					ELSE
						'.Title2 as ALTITLE_'
				END +
				CAST(al.AccountLevelID AS VARCHAR(10))
		FROM ACC.AccountLevel al
		WHERE al.AccountLevelTypeID = 1
		FOR XML PATH(''), TYPE
	).value('.', 'NVARCHAR(MAX)'),1   ,0  ,'');

	if @SelectQuery is null
	set @SelectQuery = N''

	SELECT @JoinQuery = STUFF(
	(
		SELECT DISTINCT
			   N' Left outer join Acc.Dl Dl' +  
			   CAST(al.AccountLevelID AS VARCHAR(10)) + 
			   N' on Dl' + 
			   CAST(al.AccountLevelID AS VARCHAR(10)) + 
			   + N'.DlID=vial.ALDL'  + 
			   CAST(al.AccountLevelID AS VARCHAR(10)) 
		FROM ACC.AccountLevel al
		WHERE al.AccountLevelTypeID = 1
		FOR XML PATH(''), TYPE
	).value('.', 'NVARCHAR(MAX)'),1   ,   0   ,'');

	if @JoinQuery is null 
	set @JoinQuery = N''

	SELECT @Columns = STUFF(
	(
		SELECT DISTINCT
			   ',' + QUOTENAME(al.AccountLevelID)
		FROM ACC.AccountLevel al
		FOR XML PATH(''), TYPE
	).value('.', 'NVARCHAR(MAX)'),1   ,1   ,'');

	if @Columns is null
	set @Columns = N'[-1]'

	SELECT @SelectQuery2 = STUFF(
	(
		SELECT DISTINCT
			   ',' + CASE
						 WHEN al.AccountLevelTypeID = 1 THEN
							 QUOTENAME(al.AccountLevelID) + ' as ALDl' + CAST(al.AccountLevelID AS VARCHAR(10))
						 ELSE
							 QUOTENAME(al.AccountLevelID) + ' as AL' + CAST(al.AccountLevelID AS VARCHAR(10))
					 END
		FROM ACC.AccountLevel al
		FOR XML PATH(''), TYPE
	).value('.', 'NVARCHAR(MAX)'),1   ,0   ,'');


	if @SelectQuery2 is null
	set @SelectQuery2 = N''

	SELECT alvi.VoucherItemID,
		   alvi.AccountLevelID,
		   CASE
			   WHEN alvi.DlID IS NOT NULL THEN
				   CAST(alvi.DlID AS NVARCHAR(2048))
			   WHEN alvi.DlID IS NULL THEN
				   alvi.Value
			   ELSE
				   NULL
		   END VALUE
	INTO #Test
	FROM ACC.AccountLevelVoucherItem alvi
		INNER JOIN ACC.AccountLevel al
			ON al.AccountLevelID = alvi.AccountLevelID
		INNER JOIN #T v
			ON v.VoucherItemID = alvi.VoucherItemID;


		SET @Query
			= N'select #T.*' + @SelectQuery + N'  FROM #T
	LEFT JOIN 
	(
		SELECT VoucherItemID' + @SelectQuery2
			  + N'  FROM 
		   (
					SELECT * from #Test
				) x
				PIVOT(
					MAX(VALUE)
					FOR AccountLevelID IN (' + @Columns + N')
				) p
		
	)
	 vial
	ON #T.VoucherItemID=vial.VoucherItemID ' + @JoinQuery + N' order by rno';


	EXECUTE (@Query);


END;

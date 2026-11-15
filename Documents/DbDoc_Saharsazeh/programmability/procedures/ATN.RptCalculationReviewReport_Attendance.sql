
CREATE   PROC [ATN].RptCalculationReviewReport_Attendance
(@CalendarMonthID INT)
AS
BEGIN
	DECLARE @CultureNo TINYINT,
			@Culture VARCHAR(10),
			@userId INT,
			@DateType TINYINT,
			@DateFormat VARCHAR(10);

	SET @Culture = CFG.GetuserCulture();
	SET @userId = CFG.GetuserID();

	SELECT @CultureNo = CultureNo
	FROM CFG.CultureInfo
	WHERE Culture = @Culture;

	IF @DateType IS NULL
		SET @DateType = CASE @Culture
							WHEN 'fa' THEN
								0
							WHEN 'en' THEN
								1
							WHEN 'ar' THEN
								2
						END;

	SELECT @DateFormat = us.SettingValue
	FROM CFG.UserSetting us
	WHERE us.SettingKey = 'Date_Format'
		  AND us.UserID = @userId;

	IF @DateFormat IS NULL
		SET @DateFormat = 'YY/MM/DD';

	DECLARE @PivotColumns NVARCHAR(MAX),
			@PivotSelectColumns NVARCHAR(MAX);

	SET @PivotColumns = STUFF(
								 (
									 SELECT DISTINCT
											',' + QUOTENAME(p.AttendanceParameterID)
									 FROM
									 (
										 SELECT DISTINCT
												b.*
										 FROM ATN.AttendanceCalculationMethod a
											 JOIN ATN.AttendanceParameter b
												 ON a.AttendanceParameterID = b.AttendanceParameterID
										 WHERE a.AttendanceParameterID IS NOT NULL
									 ) p
									 FOR XML PATH(''), TYPE
								 ).value('.', 'NVARCHAR(MAX)'),
								 1,
								 1,
								 ''
							 );

	SET @PivotSelectColumns
		= STUFF(
				   (
					   SELECT DISTINCT
							  ',' + QUOTENAME(p.AttendanceParameterID) + N' AS P_'
							  + CAST(p.AttendanceParameterID AS NVARCHAR(10))
					   FROM
					   (
						   SELECT DISTINCT
								  b.*
						   FROM ATN.AttendanceCalculationMethod a
							   JOIN ATN.AttendanceParameter b
								   ON a.AttendanceParameterID = b.AttendanceParameterID
						   WHERE a.AttendanceParameterID IS NOT NULL
					   ) p
					   FOR XML PATH(''), TYPE
				   ).value('.', 'NVARCHAR(MAX)'),
				   1,
				   1,
				   ''
			   );

	IF @PivotColumns IS NULL
	BEGIN
		SET @PivotColumns = N'[-1]';
	END;

	IF @PivotSelectColumns IS NULL
	BEGIN
		SET @PivotSelectColumns = N'[-1]';
	END;
	
	
	SELECT * into #vwPersonelLastAgreementInMonth
	FROM hrm.vwPersonelLastAgreementInMonth AS vplaim
	WHERE vplaim.CalendarMonthID = @CalendarMonthID
	
	SELECT * into #vwPersonelVoucherSetting
	 FROM pay.vwPersonelVoucherSetting AS vpvs
	WHERE vpvs.CalendarMonthID = @CalendarMonthID
	


	DECLARE @Query NVARCHAR(MAX)
		= N'
		SELECT row_Number() over(order by pt.Todate , pt.PersonelID) ID,
			   pt.ToDate,
			   pt.PersonelID,
			   pt.PersonelCode,
			   pt.FirstName,
			   pt.LastName,
			   pt.CostCenterTitle CostCenter,
			   pt.WorkPlaceTitle WorkPlace,
			   pt.EmploymentTypeTitle EmploymentType,
			   pt.AccountGroupTitle,
	   ' + @PivotSelectColumns
		  + N'
	   FROM (
			SELECT 
				CFG.GetCLRSaturnDate(apcr.Date, @DateFormat , 0, @DateType ) ToDate,
				apcr.AttendanceShiftItemID,
				vmp.PersonelID,
				vmp.PersonelCode,
				vmp.FirstName,
				vmp.LastName,
				vplaim.CostCenterTitle,
				vplaim.WorkPlaceTitle,
				vplaim.EmploymentTypeTitle,
				PayrollAccGroupTitle as AccountGroupTitle,
				apcr.AttendanceParameterID as ParameterId,
				CASE
					WHEN ap.DataEntryMethod = 2 THEN -- ToHourMinute ==> Hour: 2, ساعت دقیقه
						CFG.[ConvertToHourMinute](apcr.[Value])
					WHEN ap.DataEntryMethod = 3 THEN -- ToDayHourMinute ==> DayHour: 3, روز ساعت دقیقه
						CFG.[ConvertToDayHourMinute](apcr.[Value], 440)
					WHEN ap.DataEntryMethod = 1 OR ap.DataEntryMethod = 4 THEN -- Day: 1, روز  / Number: 4, عدد 
						FORMAT(apcr.[Value], ''0.######'')
					ELSE -- Default: 0, پیش فرض ریال / Amount: 5  مبلغ
						CASE
							WHEN FLOOR(apcr.[Value]) <> CEILING(apcr.[Value]) THEN
								FORMAT(apcr.[Value], ''N'' + CAST(ISNULL(CFG.GetBaseCurrencyPrecision(),2) AS NVARCHAR))
							ELSE
								FORMAT(apcr.[Value], ''N0'')
						END
				END AS val
			FROM atn.AttendanceCalculationPersonnel AS acp
			JOIN ATN.atnParameterCalculationResult AS apcr  ON apcr.AttendanceCalculationPersonnelID = acp.AttendanceCalculationPersonnelID
			JOIN ATN.AttendanceParameter ap ON apcr.AttendanceParameterID = ap.AttendanceParameterID
			JOIN HRM.vwPersonel AS vmp ON vmp.PersonelID = acp.PersonelID
			join #vwPersonelLastAgreementInMonth vplaim on vmp.PersonelID = vplaim.PersonelID
			left join #vwPersonelVoucherSetting vpvs on vmp.PersonelID = vpvs.PersonelID
			WHERE acp.CalendarMonthID = @CalendarMonthID
		) t
		PIVOT (
		  MAX(val)
		  FOR ParameterId
		  IN (' + @PivotColumns + N')
		) as pt
	';

	EXEC sys.sp_executesql @Query,
						   N'
				@CultureNo TINYINT,
				@Culture VARCHAR(10),
				@userId INT ,
				@DateType TINYINT ,
				@DateFormat VARCHAR(10),
				@CalendarMonthID int
				',
						   @CultureNo = @CultureNo,
						   @Culture = @Culture,
						   @userId = @userId,
						   @DateType = @DateType,
						   @DateFormat = @DateFormat,
						   @CalendarMonthID = @CalendarMonthID;

END;

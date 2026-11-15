
CREATE   PROC [ATN].RptCalculationReviewReport_Salary
(
	@CalendarMonthID INT
)
AS
BEGIN
	   DECLARE @CultureNo VARCHAR(10),
			@Culture VARCHAR(10);

	SET @Culture = CFG.GetuserCulture();

	SELECT @CultureNo = CultureNo
	FROM CFG.CultureInfo
	WHERE Culture = @Culture;

	DECLARE @PivotColumns NVARCHAR(MAX),
			@PivotSelectColumns NVARCHAR(MAX);

	SET @PivotColumns = STUFF(
								 (
									 SELECT DISTINCT
											',' + QUOTENAME(p.ParameterID)
									 FROM
									 (
										 SELECT DISTINCT
												b.*
										 FROM ATN.AttendanceCalculationMethod a
											 JOIN PAY.Parameter b
												 ON a.ParameterID = b.ParameterID
										 WHERE a.ParameterID IS NOT NULL
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
							  ',' + QUOTENAME(p.ParameterID) + ' AS P_' + CAST(p.ParameterID AS NVARCHAR(10))
					   FROM
					   (
						   SELECT DISTINCT
								  b.*
						   FROM ATN.AttendanceCalculationMethod a
							   JOIN PAY.Parameter b
								   ON a.ParameterID = b.ParameterID
						   WHERE a.ParameterID IS NOT NULL
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
		SELECT pt.PersonelID,
			   pt.PersonelCode,
			   pt.FirstName PersonelName,
			   pt.LastName,
			   pt.CostCenterTitle CostCenter,
			   pt.WorkPlaceTitle WorkPlace,
			   pt.EmploymentTypeTitle EmploymentType,
			   pt.PayrollAccGroupTitle AccountGroupTitle,
			   ' + @PivotSelectColumns
		  + N'
	   FROM (
			SELECT 
				vmp.PersonelID,
				vmp.PersonelCode,
				vmp.FirstName,
				vmp.LastName,
				vplaim.CostCenterTitle,
				vplaim.WorkPlaceTitle,
				vplaim.EmploymentTypeTitle,vpvs.PayrollAccGroupTitle,
				ppcr.ParameterID as ParameterId,
				CASE
					WHEN p.DataEntryType = 2 THEN -- ToHourMinute ==> Hour: 2, ساعت دقیقه
						CFG.[ConvertToHourMinute](ppcr.[Value])
					WHEN p.DataEntryType = 3 THEN -- ToDayHourMinute ==> DayHour: 3, روز ساعت دقیقه
						CFG.[ConvertToDayHourMinute](ppcr.[Value], 440)
					WHEN p.DataEntryType = 1 OR p.DataEntryType = 4 THEN -- Day: 1, روز  / Number: 4, عدد 
						FORMAT(ppcr.[Value], ''0.######'')
					ELSE -- Default: 0, پیش فرض ریال / Amount: 5  مبلغ
						CASE
							WHEN FLOOR(ppcr.[Value]) <> CEILING(ppcr.[Value]) THEN
								FORMAT(ppcr.[Value], ''N'' + CAST(ISNULL(CFG.GetBaseCurrencyPrecision(),2) AS NVARCHAR))
							ELSE
								FORMAT(ppcr.[Value], ''N0'')
						END
				END AS val
			FROM atn.AttendanceCalculationPersonnel AS acp
			JOIN ATN.PayParameterCalculationResult AS ppcr  ON ppcr.AttendanceCalculationPersonnelID = acp.AttendanceCalculationPersonnelID
			JOIN PAY.Parameter p ON ppcr.ParameterID = p.ParameterID
			JOIN HRM.vwPersonel AS vmp ON vmp.PersonelID = acp.PersonelID
			join #vwPersonelLastAgreementInMonth vplaim on vplaim.PersonelID = vmp.PersonelID
			left join #vwPersonelVoucherSetting vpvs on vmp.PersonelID = vpvs.PersonelID
			WHERE acp.CalendarMonthID = ' + CAST(@CalendarMonthID AS VARCHAR(11))
		  + N'
		) t
		PIVOT (
		  MAX(val)
		  FOR ParameterId
		  IN (' + @PivotColumns + N')
		) as pt
	';
	
	PRINT @Query

	EXECUTE (@Query);
END

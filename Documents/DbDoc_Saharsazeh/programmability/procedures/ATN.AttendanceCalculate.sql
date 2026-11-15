
CREATE   PROCEDURE [ATN].AttendanceCalculate
(
    @CalendarMonthID               INT,
    @SelectedPersonnelID           NVARCHAR(MAX),
    @CallFromPerformanceReport     TINYINT = 0,
    @PerformanceReportTable        VARCHAR(512) = NULL,
    @CalcDate						DATE = Null,
    @CalcType						TINYINT = 1
)
--WITH ENCRYPTION
WITH RECOMPILE
AS
	SET NOCOUNT ON;
	DECLARE @ErrorMessage      NVARCHAR(4000),
	        @ErrorSeverity     INT,
	        @ErrorState        INT;
	        
	DECLARE @ParameterID VARCHAR(20)
	DECLARE @SQLCondition VARCHAR(MAX) 
	DECLARE @IsPayParameter VARCHAR(250)
	DECLARE @SQLExpression VARCHAR(MAX)
	DECLARE @Query NVARCHAR(MAX) 
	DECLARE @CreatorID INT
	DECLARE @StartDate DATE
	DECLARE @CalendarMonthEndDate DATE
	DECLARE @AttendanceParameterColumns VARCHAR(MAX)
	DECLARE @TimeInterpretationColumns NVARCHAR(MAX)
	DECLARE @SelectAttendanceParameter VARCHAR(MAX)
	DECLARE @AttendanceParameterForCreateTable VARCHAR(MAX)
	DECLARE @InterpretationParametersForCreateTable NVARCHAR(MAX)
	DECLARE @PayrollParameterForCreateTable VARCHAR(MAX)
	DECLARE @Deferred BIT
	DECLARE @GroupAssignmentTable VARCHAR(512) = cfg.getTempTableName(1)
	DECLARE @CalcTable VARCHAR(512) = cfg.getTempTableName(1)
	DECLARE @MissionTable VARCHAR(512) = cfg.getTempTableName(1)
	DECLARE @LeaveTable VARCHAR(512) = cfg.getTempTableName(1)
	DECLARE @PersonelRequestTable VARCHAR(512) = cfg.getTempTableName(1)
	DECLARE @PCalcTable VARCHAR(512) = cfg.getTempTableName(1)
	DECLARE @MissionRequestTable VARCHAR(512) = cfg.getTempTableName(1)
	DECLARE @MinMissionRequestDate DATE
	DECLARE @MinMissionReportDate DATE
	DECLARE @MinDateMustDataGathered DATE
	DECLARE @FormulaID INT  

	SELECT @StartDate = AttendanceStartDate,
			@CalendarMonthEndDate            = AttendanceEndDate
	FROM   hrm.CalendarMonth
	WHERE  CalendarMonthID     = @CalendarMonthID
	
	IF @CalcDate IS NULL
	SET @CalcDate = @CalendarMonthEndDate
	
	IF @CallFromPerformanceReport = 0
	BEGIN
	    BEGIN TRY
	--print 22
	    EXEC atn.spAttendaceCalculationControls
	    	@CalendarMonthID = @CalendarMonthID,
	    	@SelectedPersonel = @SelectedPersonnelID,
	    	@Type = 1,
	    	@CalcDate = @CalcDate,
	    	@CalcType = @CalcType
	    	
	    	--print 222
	    END TRY  
	    BEGIN CATCH
	    	SELECT @ErrorMessage = ERROR_MESSAGE(),
	    	       @ErrorSeverity     = ERROR_SEVERITY(),
	    	       @ErrorState        = ERROR_STATE();
	    	
	    	
	    	RAISERROR (
	    	    @ErrorMessage,	-- Message text.
	    	    @ErrorSeverity,	-- Severity.
	    	    @ErrorState -- State.
	    	);
	    	RETURN;
	    END CATCH
	END

	SELECT @ErrorMessage = N'در روش محاسبه عامل ' + ap.Title + N' از مقدار عامل ' + ap2.Title + 
	       N' استفاده شده که فاقد فرمول است'
	FROM   atn.AttendanceCalculationMethod acm
	       JOIN atn.AttendanceCalculationMethodFormula acmf
	            ON  acm.AttendanceCalculationMethodID = acmf.AttendanceCalculationMethodID
	       JOIN atn.AttendanceCalculationMethodFormulaParameter acmfp
	            ON  acmfp.AttendanceCalculationMethodFormulaID = acmf.AttendanceCalculationMethodFormulaID
	       JOIN atn.AttendanceParameter ap
	            ON  ap.AttendanceParameterID = acm.AttendanceParameterID
	       JOIN atn.AttendanceParameter ap2
	            ON  ap2.AttendanceParameterID = acmfp.Parameter
	       left JOIN atn.AttendanceCalculationMethod acm2
	            ON  acmfp.Parameter = acm2.AttendanceParameterID
	WHERE  acmfp.Parameter is NOT null
	       AND ParameterType = 6
	       AND acm2.AttendanceCalculationMethodID is null
	       and ap2.[Type] = 2
	
	IF @ErrorMessage is NOT null
	BEGIN
	    RAISERROR (@ErrorMessage, 16, 10)
	    RETURN
	END
	
	SELECT @ErrorMessage = N'در روش محاسبه عامل ' + p.Title + N' از مقدار عامل ' + ap.Title + 
	       N' استفاده شده که فاقد فرمول است'
	FROM   atn.AttendanceCalculationMethod acm
	       JOIN atn.AttendanceCalculationMethodFormula acmf
	            ON  acm.AttendanceCalculationMethodID = acmf.AttendanceCalculationMethodID
	       JOIN atn.AttendanceCalculationMethodFormulaParameter acmfp
	            ON  acmfp.AttendanceCalculationMethodFormulaID = acmf.AttendanceCalculationMethodFormulaID
	       JOIN pay.Parameter p
	            ON  p.ParameterID = acm.ParameterID
	       JOIN atn.AttendanceParameter ap
	            ON  ap.AttendanceParameterID = acmfp.Parameter
	       left JOIN atn.AttendanceCalculationMethod acm2
	            ON  acmfp.Parameter = acm2.AttendanceParameterID
	            left join atn.VacancyNature AS vn on vn.AttendanceParameterID = ap.AttendanceParameterID
	WHERE  acmfp.Parameter is NOT null
	       AND ParameterType = 6
	       AND acm2.AttendanceCalculationMethodID is null
		   and ap.Type = 2
		   and acmfp.Category <> -5
		   and vn.AttendanceParameterID is NULL
	
	IF @ErrorMessage is NOT null
	BEGIN
	    RAISERROR (@ErrorMessage, 16, 10)
	    RETURN
	END


		SELECT @ErrorMessage = N'در روش محاسبه عامل ' + p.Title + N' از مقدار عامل ' + ap.Title + 
	       N' استفاده شده که فاقد فرمول است'
	FROM   atn.AttendanceCalculationMethod acm
	       JOIN atn.AttendanceCalculationMethodFormula acmf
	            ON  acm.AttendanceCalculationMethodID = acmf.AttendanceCalculationMethodID
	       JOIN atn.AttendanceCalculationMethodFormulaParameter acmfp
	            ON  acmfp.AttendanceCalculationMethodFormulaID = acmf.AttendanceCalculationMethodFormulaID
	       JOIN pay.Parameter p
	            ON  p.ParameterID = acm.ParameterID
	       JOIN pay.Parameter ap
	            ON  ap.ParameterID = acmfp.Parameter and acmfp.Category = -5
	       left JOIN atn.AttendanceCalculationMethod acm2
	            ON  ap.ParameterID = acm2.ParameterID
	WHERE  acmfp.Parameter is NOT null
	       AND ParameterType = 6
	       AND acm2.AttendanceCalculationMethodID is null
	
	IF @ErrorMessage is NOT null
	BEGIN
	    RAISERROR (@ErrorMessage, 16, 10)
	    RETURN
	END

	SET @CreatorID = cfg.GetuserID();
	
	SELECT VALUE PersonelID
	INTO   #selPersonel
	FROM   cfg.R_FnCommaStr2Table(@SelectedPersonnelID) rfcst
	
	DECLARE @NeedConfirm BIT
	
	SELECT @NeedConfirm = ConfigValue
	FROM   cfg.Configuration c
	WHERE  c.ConfigKey = 'AgreementNeedConfirm'
	
	IF ISNULL(@CallFromPerformanceReport, 0) = 0
	BEGIN
	    SELECT @errorMessage = N'درخواست ماموریت کد پرسنلی  ' + p.Code + N' در ماه انتخاب شده تایید یا رد نشده است. '
	    FROM   atn.MissionRequest mr
	           JOIN hrm.Personel p
	                ON  mr.PersonelID = p.PersonelID
					join #selPersonel sp on p.PersonelID = sp.PersonelID
	    WHERE  StartDate between @StartDate and @CalcDate
	           AND mr.Status = 1
	    
	    IF @ErrorMessage is NOT null
	    BEGIN
	        RAISERROR (@ErrorMessage, 16, 10)
	        RETURN
	    END
	END
	
	
		--- دریافت اطلاعات پرسنلی که در بازه ماه، پایان خدمت ندارند
	SELECT * into #vwPersonelStatusInDate 
	FROM hrm.vwPersonelStatusInDate AS vpsid
	WHERE vpsid.[Date] between @StartDate and @CalcDate
	and vpsid.[STATUS] <> 3
	
	SELECT PersonelID,
	       T.EmploymentDate,
	       ExecuteDate,
	       STATUS,
	      0 [P5_-16] ---UpdateThen
	INTO   #lastAggreement
	FROM   (
	           SELECT a.*,
	                  ROW_NUMBER() OVER(PARTITION BY a.PersonelID ORDER BY a.IssueDate DESC) AS Rno,
	                  STATUS
	           FROM   HRM.Agreement a
	                  INNER JOIN #selPersonel b
	                       ON  b.PersonelID = a.PersonelID
	                  left JOIN (
	                           SELECT AgreementID,
	                                  STATUS
	                           FROM   HRM.ChangePersonelStatus
	                           GROUP BY
	                                  AgreementID,
	                                  STATUS
	                       )cps
	                       ON  cps.AgreementID = a.AgreementID
	           WHERE  a.ExecuteDate <= @CalcDate
	                  AND (
	                          @NeedConfirm = 0
	                          OR (a.ConfirmDate IS NOT NULL AND a.ConfirmDate <= @CalcDate )
	                      )
	                  AND a.IssueDate <= @CalcDate
	       ) T
	WHERE  T.Rno = 1
	
	--- پیداکردن کارکرد مجاز و بروزرسانی #LastAgreement
	UPDATE la
	set la.[P5_-16] = b.InEmploymentDays
	 FROM #lastAggreement AS la
	join (
	SELECT vpsid.PersonelID,COUNT(*) InEmploymentDays
	  FROM #vwPersonelStatusInDate AS vpsid
	GROUP BY vpsid.PersonelID) b on la.PersonelID = b.PersonelID
	
	
	CREATE TABLE #MinDate
	(
		MinDate DATE
	)
	
	INSERT INTO #MinDate
	SELECT MIN(mr.StartDate)
	FROM   atn.MissionRequest    AS mr
	       JOIN atn.RequestType  AS rt
	            ON  rt.RequestTypeID = mr.RequestTypeID
	            AND rt.Timing = 2
	       JOIN #selPersonel p
	            ON  mr.PersonelID = p.PersonelID
	WHERE  mr.EffectiveDate BETWEEN @StartDate AND @CalcDate
	
	
	INSERT INTO #MinDate(MinDate)
	SELECT MIN(mr.StartDate)
	FROM   atn.MissionReport AS mr
	       JOIN #selPersonel p
	            ON  mr.PersonelID = p.PersonelID
	WHERE  mr.[Date] BETWEEN @StartDate AND @CalcDate
	
	INSERT INTO #MinDate(MinDate)
	       VALUES
	       (@StartDate)
	SELECT @MinDateMustDataGathered = MIN(MinDate)
	FROM   #MinDate
	WHERE  MinDate is NOT null
	
	;with 
	cte1 as
	(
	    SELECT t.AttendanceCalculationMethodID,
	           t.AttendanceParameterID,
	           t.date
	    FROM   (
	               SELECT cm.AttendanceCalculationMethodID,
	                      cm.AttendanceParameterID,
	                      cm.date,
	                      ROW_NUMBER() OVER(
	                          PARTITION BY cm.AttendanceParameterID ORDER BY cm.Date DESC
	                      ) AS Rno
	               FROM   ATN.AttendanceCalculationMethod cm
	               join atn.AttendanceParameter AS ap on ap.AttendanceParameterID = cm.AttendanceParameterID
	               WHERE  ap.AttendanceParameterID is NOT null
	                      AND cm.DATE < @StartDate
	                      and ap.TimingMethod = 1
	           ) T
	    WHERE  Rno = 1
	    UNION all 
	    SELECT cm.AttendanceCalculationMethodID,
	           cm.AttendanceParameterID,
	           cm.date
	    FROM   ATN.AttendanceCalculationMethod cm
	    join atn.AttendanceParameter AS ap on ap.AttendanceParameterID = cm.AttendanceParameterID
	    WHERE  cm.AttendanceParameterID is NOT null
	           AND DATE between @StartDate and @CalcDate
	           and ap.TimingMethod = 1
	),
	cte2 as
	(
	    SELECT ROW_NUMBER() OVER(PARTITION BY AttendanceParameterID ORDER BY DATE) AS Rno,
	           *
	    FROM   cte1
	),
	cte3 as
	(
	    SELECT a.AttendanceCalculationMethodID,
	           a.AttendanceParameterID,
	           a.Date                       SDate,
	           ISNULL(b.Date, @CalcDate)     EDate
	    FROM   cte2 a
	           left JOIN cte2 b
	                ON  a.AttendanceParameterID = b.AttendanceParameterID
	                AND a.rno = b.Rno - 1
	)
	SELECT t.AttendanceCalculationMethodID MethodID,
	       t.AttendanceParameterID,
	       f.AttendanceCalculationMethodFormulaID FormulaID,
	       f.SQLCondition,
	       f.SQLExpression,
	       CASE 
	            WHEN acmfp.AttendanceCalculationMethodFormulaParameterID IS NULL THEN 0
	            ELSE 1
	       END Deferred,
	       T.SDate,
	       T.EDate
	INTO   #AttendanceParameter
	FROM   cte3 T
	       LEFT JOIN ATN.AttendanceCalculationMethodFormula f
	            ON  f.AttendanceCalculationMethodID = t.AttendanceCalculationMethodID
	       LEFT JOIN ATN.AttendanceCalculationMethodFormulaParameter acmfp
	            ON  acmfp.AttendanceCalculationMethodFormulaID = f.AttendanceCalculationMethodFormulaID
	            AND ParameterValueType = -15
	

	    SELECT *
	    INTO   #vwPersonelShiftInDate
	    FROM   atn.vwPersonelShiftInDate AS vpsid
	    WHERE  vpsid.PersonelID IN (SELECT sp.PersonelID
	                                FROM   #selPersonel AS sp)
  SELECT *
	    INTO   #vwAttendanceShift
	    FROM   atn.vwAttendanceShift AS vas
	    WHERE  vas.StartDate between @StartDate and @CalcDate

	
	SELECT a.PersonelID,
	       psd.AttendanceShiftID,
	       vas.IsWorkingDay,
	       CASE 
	            WHEN ac.DayType IN (1,2) OR vas.IsWorkingDay = 0 or (la.status <> 5 AND vas.StartDate >= la.ExecuteDate) THEN 
	                 0
	            WHEN ac.AttendanceCalendarID IS NOT NULL THEN DATEDIFF(minute, '1970-01-01', ac.[Date]) + ac.StartHour
	            ELSE vas.ShiftStartingHour
	       END               StartHour,
	       CASE 
	            WHEN ac.DayType IN (1,2) OR vas.IsWorkingDay = 0 or (la.status <> 5 AND vas.StartDate >= la.ExecuteDate) THEN 
	                 0
	            WHEN ac.AttendanceCalendarID IS NOT NULL THEN DATEDIFF(minute, '1970-01-01', ac.[Date]) + ac.EndHour
	            ELSE vas.ShiftEndingHour
	       END               EndHour,
	       vas.StartDate     EffectiveDate,
	       vas.StartDate     CalcDate,
	       CASE WHEN ac.DayType IN (1,2) then 1 
	       when vas.IsWorkingDay = 0 then 1
	       else 0
	        END Holiday,
	       CASE WHEN ac.DayType = 1 then 1 when vas.DayType = 1 then 1 else 0 END FormalHoliday,
	       CASE WHEN ac.DayType = 2 then 1 when vas.DayType = 2 then 1 else 0 END ShiftHoliday ,
	       AttendanceCalendarID,
	       CASE 
	            WHEN MissionRequestID IS NULL THEN 0
	            ELSE 1
	       END               MissionDay,
	       vas.AttendanceShiftItemID,
	       CASE 
	            WHEN ac.DayType IN (1,2) THEN 0
	            WHEN ac.StartHour is NOT NULL THEN DATEDIFF(minute, '1970-01-01', ac.[Date]) + ac.StartHour
	            ELSE vas.ShiftStartingHour
	       END               ShiftStartingHour,
	       CASE 
	            WHEN ac.DayType IN (1,2) THEN 0
	            WHEN ac.EndHour is NOT NULL THEN DATEDIFF(minute, '1970-01-01', ac.[Date]) + ac.EndHour
	            ELSE vas.ShiftEndingHour
	       END               ShiftEndingHour,
	       vas.StartingLimitHour,
	       vas.EndingLimitHour,
		   vas.StartDate,
		   vas.EndDate,
		   vas.starthour ss,
		   vas.endhour ee,
		   vas.VacancyDuration ,
		   CASE WHEN dd.DayOfWeekName = 'Friday' then 1 else 0 END IsFriday       
	INTO   #PersonnelDate
	FROM   #selPersonel a
	       INNER JOIN #vwPersonelShiftInDate psd
	            ON  a.PersonelID = psd.PersonelID
	       INNER JOIN #vwAttendanceShift vas
	            ON  vas.AttendanceShiftID = psd.AttendanceShiftID
	            AND psd.Date = vas.StartDate
	       LEFT JOIN (
	                SELECT mr.PersonelID,
	                       MissionRequestID,
	                       mr.effectiveDate,
	                       dd.date
	                FROM   atn.MissionRequest mr
	                       JOIN atn.RequestType AS rt
	                            ON  rt.RequestTypeID = mr.RequestTypeID
	                            AND rt.Timing = 2
	                       JOIN cfg.dimdate dd
	                            ON  dd.date BETWEEN mr.startdate AND mr.enddate
	                WHERE  effectiveDate IS NOT NULL
	            )mr
	            ON  mr.PersonelID = a.PersonelID
	            AND mr.date = vas.StartDate
	       LEFT JOIN ATN.AttendanceCalendar ac
	            ON  ac.AttendanceShiftID = psd.AttendanceShiftID
	            AND ac.Date = vas.StartDate
	       left JOIN #lastAggreement la
	            ON  la.PersonelID = a.PersonelID
	        left join cfg.DimDate AS dd on psd.[Date] = dd.[Date]    
	WHERE  vas.StartDate BETWEEN @MinDateMustDataGathered AND @CalcDate		



	-----فراخوانی کارکردها 
 	SELECT [Type],
	FullID,
	       a.PersonelID,
	       a.EffectiveDate Date,
	       a.Date As RecordDate,
	       CASE 
	            WHEN a.[Hour] IS NULL AND [SOrEType] = 'S' THEN b.StartHour
	            WHEN a.[Hour] IS NULL AND [SOrEType] = 'E' THEN b.EndHour
	            ELSE DATEDIFF(minute, '1970-01-01', a.date) + a.[Hour]
	       END [Hour],
	       [SOrEType],
	       0     DiffTime,
	       0     DiffTimeInShift,
	       0 as DiffTimeAfterShift,
		   0 as DiffTimeBeforeShift,
	       a.Document,
	       a.RequestTypeID
	INTO   #TempEntryAndExit
	FROM   (
	           SELECT 1 [Type],
			   concat('EntryAndExit-',EntryAndExitID) FullID,
	                  ee.PersonelID,
	                  ee.Date ,
					  pd.StartDate EffectiveDate,
	                  [Hour],
	                  'N' [SOrEType],
	                  'EntryAndExit' As [Document],
	                  -1 as RequestTypeID
	           FROM   atn.EntryAndExit ee
	                  JOIN #selPersonel AS sp
	                       ON  ee.PersonelID = sp.PersonelID
						   join #PersonnelDate pd on ee.PersonelID = pd.PersonelID 
						   and (DATEDIFF(minute,'1970-01-01',ee.date) + ee.Hour) between pd.StartingLimitHour and pd.EndingLimitHour
	          

	           UNION ALL
	           SELECT 2 [Type],
			   	   concat('LeaveRequest-',lr.LeaveRequestID) FullID,
	                  lr.PersonelID,
	                  lr.StartDate,
					  pd.StartDate EffectiveDate,
	                  lr.StartHour,
	                  'S' [SOrEType],
	                  'LeaveRequest' As [Document],
	                  rt.RequestTypeID
	           FROM   atn.LeaveRequest lr
			   join atn.RequestType rt on lr.RequestTypeID = rt.RequestTypeID 
	                  JOIN #selPersonel AS sp
	                       ON  lr.PersonelID = sp.PersonelID
						     join #PersonnelDate pd on lr.PersonelID = pd.PersonelID 
						   and (DATEDIFF(minute,'1970-01-01',lr.StartDate) + lr.StartHour) between pd.StartingLimitHour and pd.EndingLimitHour
	           WHERE   STATUS = 2
			   and rt.Timing = 1

	           UNION ALL

	           SELECT 2 [Type],
			   	   concat('LeaveRequest-',lr.LeaveRequestID) FullID,
	                  lr.PersonelID,
	                  ISNULL(lr.EndDate ,lr.StartDate),
					  pd.StartDate EffectiveDate,
	                  lr.EndHour,
	                  'E' [SOrEType],
	                  'LeaveRequest' As [Document],
	                  rt.RequestTypeID
	           FROM   atn.LeaveRequest lr			   
			   join atn.RequestType rt on lr.RequestTypeID = rt.RequestTypeID 
	                  JOIN #selPersonel AS sp
	                       ON  lr.PersonelID = sp.PersonelID
						     join #PersonnelDate pd on lr.PersonelID = pd.PersonelID 
						   and (DATEDIFF(minute,'1970-01-01',lr.StartDate) + lr.EndHour) between pd.StartingLimitHour and pd.EndingLimitHour
	           WHERE   STATUS = 2
			   and rt.Timing = 1
			    UNION ALL
	           SELECT 2 [Type],
			   	   concat('LeaveRequest-',lr.LeaveRequestID) FullID,
	                  lr.PersonelID,
	                  lr.Date,
					  pd.StartDate EffectiveDate,
	                  lr.StartHour,
	                  'S' [SOrEType],
	                  'LeaveRequest' As [Document],rt.RequestTypeID
	           FROM   atn.LeaveRequest lr
			   join atn.RequestType rt on lr.RequestTypeID = rt.RequestTypeID 
	                  JOIN #selPersonel AS sp
	                       ON  lr.PersonelID = sp.PersonelID
						     join #PersonnelDate pd on lr.PersonelID = pd.PersonelID 
						    and pd.StartDate between lr.StartDate and lr.EndDate
	           WHERE   STATUS = 2
			   and rt.Timing = 2
	           UNION ALL
	           SELECT 2 [Type],
			   	   concat('LeaveRequest-',lr.LeaveRequestID) FullID,
	                  lr.PersonelID,
	                  lr.Date,
					  pd.StartDate EffectiveDate,
	                  lr.EndHour,
	                  'E' [SOrEType],
	                  'LeaveRequest' As [Document],rt.RequestTypeID
	           FROM   atn.LeaveRequest lr			   
			   join atn.RequestType rt on lr.RequestTypeID = rt.RequestTypeID 
	                  JOIN #selPersonel AS sp
	                       ON  lr.PersonelID = sp.PersonelID
						     join #PersonnelDate pd on lr.PersonelID = pd.PersonelID 
						   and pd.StartDate between lr.StartDate and lr.EndDate
	           WHERE   STATUS = 2
			   and rt.Timing = 2

			     UNION ALL
	           SELECT 2 [Type],
			   	   concat('MissionRequest-',lr.MissionRequestID) FullID,
	                  lr.PersonelID,
	                  lr.StartDate,
					  pd.StartDate EffectiveDate,
	                  lr.StartHour,
	                  'S' [SOrEType],
	                  'MissionRequest' As [Document],rt.RequestTypeID
	           FROM   atn.MissionRequest lr
			   join atn.RequestType rt on lr.RequestTypeID = rt.RequestTypeID 
	                  JOIN #selPersonel AS sp
	                       ON  lr.PersonelID = sp.PersonelID
						     join #PersonnelDate pd on lr.PersonelID = pd.PersonelID 
						   and (DATEDIFF(minute,'1970-01-01',lr.StartDate) + lr.StartHour) between pd.StartingLimitHour and pd.EndingLimitHour
	           WHERE   STATUS in(2,4)
			   and rt.Timing = 1
	           UNION ALL
	           SELECT 2 [Type],
			   	   concat('MissionRequest-',lr.MissionRequestID) FullID,
	                  lr.PersonelID,
	                  ISNULL(lr.EndDate ,lr.StartDate),
					  pd.StartDate EffectiveDate,
	                  lr.EndHour,
	                  'E' [SOrEType],
	                  'MissionRequest' As [Document],rt.RequestTypeID
	           FROM   atn.MissionRequest lr			   
			   join atn.RequestType rt on lr.RequestTypeID = rt.RequestTypeID 
	                  JOIN #selPersonel AS sp
	                       ON  lr.PersonelID = sp.PersonelID
						     join #PersonnelDate pd on lr.PersonelID = pd.PersonelID 
						   and (DATEDIFF(minute,'1970-01-01',lr.StartDate) + lr.EndHour) between pd.StartingLimitHour and pd.EndingLimitHour
	           WHERE   STATUS in (2,4)
			   and rt.Timing = 1
			    UNION ALL
	           SELECT 2 [Type],
			   	   concat('MissionRequest-',lr.MissionRequestID) FullID,
	                  lr.PersonelID,
	                  lr.Date,
					  pd.StartDate EffectiveDate,
	                  lr.StartHour,
	                  'S' [SOrEType],
	                  'MissionRequest' As [Document],rt.RequestTypeID
	           FROM   atn.MissionRequest lr
			   join atn.RequestType rt on lr.RequestTypeID = rt.RequestTypeID 
	                  JOIN #selPersonel AS sp
	                       ON  lr.PersonelID = sp.PersonelID
						     join #PersonnelDate pd on lr.PersonelID = pd.PersonelID 
						    and pd.StartDate between lr.StartDate and lr.EndDate
	           WHERE   STATUS in (2,4)
			   and rt.Timing = 2
	           UNION ALL
	           SELECT 2 [Type],
			   	   concat('MissionRequest-',lr.MissionRequestID) FullID,
	                  lr.PersonelID,
	                  lr.Date,
					  pd.StartDate EffectiveDate,
	                  lr.EndHour,
	                  'E' [SOrEType],
	                  'MissionRequest' As [Document],rt.RequestTypeID
	           FROM   atn.MissionRequest lr			   
			   join atn.RequestType rt on lr.RequestTypeID = rt.RequestTypeID 
	                  JOIN #selPersonel AS sp
	                       ON  lr.PersonelID = sp.PersonelID
						     join #PersonnelDate pd on lr.PersonelID = pd.PersonelID 
						   and pd.StartDate between lr.StartDate and lr.EndDate
	           WHERE   STATUS in (2,4)
			   and rt.Timing = 2
			           
	           UNION ALL
	           
	         	           SELECT 2 [Type],
			   	   concat('PersonelRequest-',lr.PersonelRequestID) FullID,
	                  lr.PersonelID,
	                  lr.StartDate,
					  pd.StartDate EffectiveDate,
	                  lr.StartHour,
	                  'S' [SOrEType],
	                  'PersonelRequest' As [Document],rt.RequestTypeID
	           FROM   atn.PersonelRequest lr
			   join atn.RequestType rt on lr.RequestTypeID = rt.RequestTypeID 
	                  JOIN #selPersonel AS sp
	                       ON  lr.PersonelID = sp.PersonelID
						     join #PersonnelDate pd on lr.PersonelID = pd.PersonelID 
						   and (DATEDIFF(minute,'1970-01-01',lr.StartDate) + lr.StartHour) between pd.StartingLimitHour and pd.EndingLimitHour
	           WHERE   STATUS in(2,4)
			   and rt.Timing = 1
	           UNION ALL
	           SELECT 2 [Type],
			   	   concat('PersonelRequest-',lr.PersonelRequestID) FullID,
	                  lr.PersonelID,
	                  ISNULL(lr.EndDate ,lr.StartDate),
					  pd.StartDate EffectiveDate,
	                  lr.EndHour,
	                  'E' [SOrEType],
	                  'PersonelRequest' As [Document],rt.RequestTypeID
	           FROM   atn.PersonelRequest lr			   
			   join atn.RequestType rt on lr.RequestTypeID = rt.RequestTypeID 
	                  JOIN #selPersonel AS sp
	                       ON  lr.PersonelID = sp.PersonelID
						     join #PersonnelDate pd on lr.PersonelID = pd.PersonelID 
						   and (DATEDIFF(minute,'1970-01-01',lr.StartDate) + lr.EndHour) between pd.StartingLimitHour and pd.EndingLimitHour
	           WHERE   STATUS in (2,4)
			   and rt.Timing = 1
			    UNION ALL
	           SELECT 2 [Type],
			   	   concat('PersonelRequest-',lr.PersonelRequestID) FullID,
	                  lr.PersonelID,
	                  lr.Date,
					  pd.StartDate EffectiveDate,
	                  lr.StartHour,
	                  'S' [SOrEType],
	                  'PersonelRequest' As [Document],rt.RequestTypeID
	           FROM   atn.PersonelRequest lr
			   join atn.RequestType rt on lr.RequestTypeID = rt.RequestTypeID 
	                  JOIN #selPersonel AS sp
	                       ON  lr.PersonelID = sp.PersonelID
						     join #PersonnelDate pd on lr.PersonelID = pd.PersonelID 
						    and pd.StartDate between lr.StartDate and lr.EndDate
	           WHERE   STATUS in (2,4)
			   and rt.Timing = 2
	           UNION ALL
	           SELECT 2 [Type],
			   	   concat('PersonelRequest-',lr.PersonelRequestID) FullID,
	                  lr.PersonelID,
	                  lr.Date,
					  pd.StartDate EffectiveDate,
	                  lr.EndHour,
	                  'E' [SOrEType],
	                  'PersonelRequest' As [Document],rt.RequestTypeID
	           FROM   atn.PersonelRequest lr			   
			   join atn.RequestType rt on lr.RequestTypeID = rt.RequestTypeID 
	                  JOIN #selPersonel AS sp
	                       ON  lr.PersonelID = sp.PersonelID
						     join #PersonnelDate pd on lr.PersonelID = pd.PersonelID 
						   and pd.StartDate between lr.StartDate and lr.EndDate
	           WHERE   STATUS in (2,4)
			   and rt.Timing = 2
	       )a
	       JOIN #PersonnelDate b
	            ON  a.PersonelID = b.PersonelID
	            AND a.EffectiveDate = b.EffectiveDate
	            
	            
	        if @CallFromPerformanceReport = 2
	        BEGIN
	        	EXEC (N'select * into '+@PerformanceReportTable + N' 
	        	        from #TempEntryAndExit')
	        	        return
	        END    

		

--SELECT DATEADD(minute,hour,'1970-01-01'),* FROM #TempEntryAndExit
	SELECT a.Type,
	a.FullID,
	       a.PersonelID,
	       a.Date              EntryAndExitDate,
	       c.EffectiveDate     DATE,
	       a.Hour [Hour],
	       a.SOrEType,
	       a.DiffTime,
	       a.DiffTimeInShift,
	       a.DiffTimeAfterShift,
		   a.DiffTimeBeforeShift,
	       c.StartHour,
	       c.EndHour,
	       c.AttendanceShiftItemID,
	       ROW_NUMBER() OVER(
	           PARTITION BY [Type],
	           a.PersonelID,
	           c.StartDate,
	           AttendanceShiftItemID ORDER BY [Hour],FullID) Rno,a.RequestTypeID
	INTO   #EntryAndExit
	FROM   #TempEntryAndExit a
	       left JOIN #PersonnelDate c
	            ON  a.PersonelID = c.PersonelID
	            AND a.Hour between c.StartingLimitHour and c.EndingLimitHour

	UPDATE #EntryAndExit
	SET    [SOrEType] = CASE 
	                         WHEN Rno % 2 = 0 THEN 'E'
	                         ELSE 'S'
	                    END
	WHERE  [SOrEType] = 'N'
	
	UPDATE a
	SET    [Hour] = CASE 
	                     WHEN [Hour] IS NULL THEN CASE 
	                                                   WHEN [SOrEType] = 'S' THEN a.StartHour
	                                                   WHEN [SOrEType] = 'E' THEN a.EndHour
	                                              END
	                     ELSE a.[Hour]
	                END
	FROM   #EntryAndExit a



		UPDATE a
	SET    DiffTime = a.Hour - b.Hour
	FROM   #EntryAndExit a
	       JOIN #EntryAndExit b
	           on a.fullid = b.fullid
	WHERE  a.SOrEType = 'e'
	and a.type <> 1

	UPDATE a
	SET    DiffTime = a.Hour - b.Hour
	FROM   #EntryAndExit a
	       JOIN #EntryAndExit b
	            ON  a.PersonelID = b.PersonelID
	            AND a.Date = b.Date
	            AND a.Rno = b.Rno + 1
	            AND a.Type = b.Type
	WHERE  a.SOrEType = 'e'
	and a.Type = 1



		UPDATE a
	SET    DiffTimeInShift = CASE 
	                              WHEN a.Hour > a.EndHour THEN a.EndHour
	                              WHEN a.hour < a.startHour THEN a.StartHour
	                              ELSE a.Hour
	                         END - 
	       CASE 
	            WHEN b.Hour < a.StartHour THEN a.StartHour
	            WHEN b.hour > a.endhour THEN a.endhour
	            ELSE ISNULL(b.Hour, 0)
	       END
	FROM   #EntryAndExit a
	       JOIN #EntryAndExit b
	            ON  a.FullID = b.FullID
	WHERE  a.SOrEType = 'e'
	and a.Type <> 1

	
	UPDATE a
	SET    DiffTimeInShift = CASE 
	                              WHEN a.Hour > a.EndHour THEN a.EndHour
	                              WHEN a.hour < a.startHour THEN a.StartHour
	                              ELSE a.Hour
	                         END - 
	       CASE 
	            WHEN b.Hour < a.StartHour THEN a.StartHour
	            WHEN b.hour > a.endhour THEN a.endhour
	            ELSE ISNULL(b.Hour, 0)
	       END
	FROM   #EntryAndExit a
	       JOIN #EntryAndExit b
	            ON  a.PersonelID = b.PersonelID
	            AND a.Date = b.Date
	            AND a.Rno = b.Rno + 1
	            AND a.Type = b.Type
	WHERE  a.SOrEType = 'e'
	and a.Type = 1
	

	
		UPDATE a
	SET    DiffTimeAfterShift = CASE 
	                              WHEN a.Hour > a.EndHour THEN a.Hour else 
	                             a.EndHour
	                         END - 
	       CASE 
	            WHEN b.Hour >b.EndHour then b.Hour else b.EndHour
	       END
	FROM   #EntryAndExit a
	       JOIN #EntryAndExit b
	            ON  a.PersonelID = b.PersonelID
	            AND a.Date = b.Date
	            AND a.Rno = b.Rno + 1
	            AND a.Type = b.Type
	WHERE  a.SOrEType = 'e'
	


	
		UPDATE a
	SET    DiffTimeBeforeShift = CASE 
	                              WHEN a.Hour > a.StartHour THEN a.StartHour else 
	                             a.Hour
	                         END - 
	       CASE 
	            WHEN b.Hour <b.StartHour then b.Hour else b.StartHour
	       END
	FROM   #EntryAndExit a
	       JOIN #EntryAndExit b
	            ON  a.PersonelID = b.PersonelID
	            AND a.Date = b.Date
	            AND a.Rno = b.Rno + 1
	            AND a.Type = b.Type
	WHERE  a.SOrEType = 'e'

	




	SELECT a.Date,
	       a.personelid,
	       a.hour     StartHour,
	       b.hour     EndHour
	INTO   #TimeSheetEntryAndExit
	FROM   #EntryAndExit a
	       JOIN #EntryAndExit b
	            ON  a.personelid = b.personelid
	            AND a.date = b.date
	            AND a.rno = b.rno -1
	            AND a.type = b.type
	            AND a.Type = 1
	WHERE  a.rno % 2 = 1
	
	
	SELECT PersonnelID,
	       DATE,
	       SUM(Amount) Amount
	INTO   #Food
	FROM   hrm.FoodOrder h
	       JOIN hrm.FoodOrderItem i
	            ON  h.FoodOrderID = i.FoodOrderID
	GROUP BY
	       PersonnelID,
	       DATE


	
	SELECT ROW_NUMBER() OVER(PARTITION BY PersonelID ORDER BY IssueDate DESC) Rno,
	       PersonelID,
	       EmploymentTypeID
	INTO   #Agreement
	FROM   HRM.Agreement
	WHERE  IssueDate <= @CalcDate
	
	
	DECLARE @Group VARCHAR(MAX)
	DECLARE @GroupSelect VARCHAR(MAX)
	SELECT @Group = STUFF(
	           (
	               SELECT DISTINCT ',' + QUOTENAME(AttendanceGroupTypeID)
	               FROM   ATN.[AttendanceGroupType]
	                      FOR XML PATH(''),
	                      TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           1,
	           ''
	       )
	
	SELECT @GroupSelect = STUFF(
	           (
	               SELECT DISTINCT ',' + QUOTENAME(AttendanceGroupTypeID) + ' as [P3_-2_' + CAST(AttendanceGroupTypeID AS VARCHAR(50))
	                      + ']'
	               FROM   ATN.[AttendanceGroupType]
	                      FOR XML PATH(''),
	                      TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           0,
	           ''
	       )
	
	SELECT PersonelID,
	       AttendanceGroupID,
	       AttendanceGroupTypeID
	INTO   #LatestGroupAssignment
	FROM   (
	           SELECT ROW_NUMBER() OVER(
	                      PARTITION BY PersonelID,
	                      AttendanceGroupTypeID ORDER BY b.AttendanceEndDate DESC
	                  ) Rno,
	                  PersonelID,
	                  AttendanceGroupTypeID,
	                  a.AttendanceGroupID
	           FROM   [ATN].[GroupAssignment] a
	                  JOIN hrm.CalendarMonth b
	                       ON  a.CalendarMonthID = b.CalendarMonthID
	                  JOIN atn.AttendanceGroup c
	                       ON  a.AttendanceGroupID = c.AttendanceGroupID
	           WHERE  b.AttendanceEndDate <= @CalcDate
	       )A
	WHERE  Rno = 1
	
	
	SET @Query = N'
	select PersonelID' + @GroupSelect + '
	into ' + @GroupAssignmentTable +
	    '
	from
	(
	SELECT PersonelID,AttendanceGroupTypeID,AttendanceGroupID
	from #LatestGroupAssignment 
	)x
	pivot
	(
	max(AttendanceGroupID)
	for AttendanceGroupTypeID in (' + @Group + ')
	)p
	'
	
	EXEC (@Query)
	
	SELECT @AttendanceParameterForCreateTable = STUFF(
	           (
	               SELECT DISTINCT ',[P6_-6_' + CAST(AttendanceParameterID AS VARCHAR(10)) + '_-8] decimal(36,10)'
	               FROM (
	               	SELECT AttendanceParameterID
	               FROM   #AttendanceParameter
	               GROUP BY
	                      AttendanceParameterID
	                      
	               UNION ALL
	              SELECT ap.AttendanceParameterID FROM atn.AttendanceParameter AS ap
	              left join atn.AttendanceCalculationMethod AS acm on acm.AttendanceParameterID = ap.AttendanceParameterID
	              WHERE acm.AttendanceCalculationMethodID is null and  ap.[Type] <> 2
	               and ap.TimingMethod = 1
	               ) a
	                      
	                      FOR XML PATH(''),
	                      TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           1,
	           ''
	)
	
	
	
SELECT @InterpretationParametersForCreateTable = STUFF(
	           (
	           	
	           	SELECT * FROM (
	               SELECT DISTINCT ',[P8_' + CAST(ati.AttendanceTimeInterpretationID AS VARCHAR(10)) + '_-1_-8] decimal(36,10)' ColumnName
	               FROM atn.AttendanceTimeInterpretation AS ati
	               UNION ALL
	               SELECT ',[P8_' + CAST(ati.AttendanceTimeInterpretationID AS VARCHAR(10)) + '_'+cast (rt.RequestTypeID as nvarchar(250))+N'_-8] decimal(36,10)'
	                FROM atn.AttendanceTimeInterpretation AS ati
	               cross join atn.RequestType AS rt 
	           	) a
	                      
	                      FOR XML PATH(''),
	                      TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           1,
	           ''
	)	

	
	
	CREATE TABLE #TimeInterpretation
		(AttendanceTimeInterpretationID NVARCHAR(250),
	    PersonelID int,
	    [Date] Date,
	    AttendanceShiftItemID int,
	    StartHour int,
	    EndHour int,
	    AttendanceTime DECIMAL(36,10))
	
	if @InterpretationParametersForCreateTable is NOT NULL
	BEGIN 
		
		;WITH
	InterpretationWindows AS (
		-- بازه‌(های) تفسیرِ شیفتِ همون پرسنل در همون روز (مثلاً بازه‌ی ناهار)
		-- جوین از طریق AttendanceShiftID + تطبیق AttendanceShiftItemID با آیتمِ همون روز (نه هر روز هفته)
		SELECT DISTINCT
		       pd.PersonelID,
		       pd.EffectiveDate            AS [Date],
		       pd.AttendanceShiftItemID,
		       DATEDIFF (minute,'1970-01-01',pd.EffectiveDate) + atii.StartHour StartHour,
		       DATEDIFF (minute,'1970-01-01',pd.EffectiveDate)+atii.EndHour EndHour,ati.AttendanceTimeInterpretationID
		FROM   #PersonnelDate pd
		       JOIN atn.AttendanceTimeInterpretation AS ati
		            ON  ati.AttendanceShiftID = pd.AttendanceShiftID
		       JOIN atn.AttendanceTimeInterpretationItem AS atii
		            ON  atii.AttendanceTimeInterpretationID = ati.AttendanceTimeInterpretationID
		            AND atii.AttendanceShiftItemID = pd.AttendanceShiftItemID
	),
	-- =====================================================================
	-- شاخه‌ی ۱: حضورِ خالصِ اثرانگشتی (-1). چون مرخصی/مأموریت/درخواست‌پرسنلی
	-- swipe واقعی ندارن، شروعِ هر کدوم مثل یک "خروجِ ضمنی" و پایانش مثل یک
	-- "ورودِ ضمنی" برای حضورِ فیزیکی در نظر گرفته می‌شه؛ این‌طوری اگه کسی قبل
	-- از ۱۲ داخل بوده و وسطِ بازه مرخصی ثبت کرده، اون بازه از حضور کسر می‌شه.
	-- =====================================================================
	CombinedPresenceEvents AS (
		SELECT PersonelID, [Date], AttendanceShiftItemID, Hour, SOrEType
		FROM   #EntryAndExit
		WHERE  RequestTypeID = -1

		UNION ALL

		SELECT PersonelID, [Date], AttendanceShiftItemID, Hour,
		       CASE SOrEType WHEN 'S' THEN 'E' ELSE 'S' END
		FROM   #EntryAndExit
		WHERE  RequestTypeID <> -1
	),
	StartState_Net AS (
		SELECT w.PersonelID, w.[Date], w.AttendanceShiftItemID, w.StartHour, w.EndHour, w.AttendanceTimeInterpretationID,
		       x.SOrEType AS StateBeforeWindow
		FROM   InterpretationWindows w
		       OUTER APPLY (
		           SELECT TOP 1 c.SOrEType
		           FROM   CombinedPresenceEvents c
		           WHERE  c.PersonelID = w.PersonelID
		                  AND c.[Date] = w.[Date]
		                  AND c.AttendanceShiftItemID = w.AttendanceShiftItemID
		                  AND c.Hour < w.StartHour
		           ORDER BY c.Hour DESC
		       ) x
	),
	WindowEvents_Net AS (
		SELECT ss.PersonelID, ss.[Date], ss.AttendanceShiftItemID, ss.StartHour, ss.EndHour,
		       c.Hour, c.SOrEType, ss.AttendanceTimeInterpretationID
		FROM   StartState_Net ss
		       JOIN CombinedPresenceEvents c
		            ON  c.PersonelID = ss.PersonelID
		            AND c.[Date] = ss.[Date]
		            AND c.AttendanceShiftItemID = ss.AttendanceShiftItemID
		            AND c.Hour >= ss.StartHour AND c.Hour < ss.EndHour

		UNION ALL

		SELECT ss.PersonelID, ss.[Date], ss.AttendanceShiftItemID, ss.StartHour, ss.EndHour,
		       ss.StartHour, 'S', ss.AttendanceTimeInterpretationID
		FROM   StartState_Net ss
		WHERE  ISNULL(ss.StateBeforeWindow, 'E') = 'S'
	),
	Ordered_Net AS (
		SELECT
		    PersonelID, [Date], AttendanceShiftItemID, StartHour, EndHour, Hour, SOrEType,
		    we.AttendanceTimeInterpretationID,
		    LEAD(Hour, 1, EndHour) OVER (
		        PARTITION BY PersonelID, [Date], AttendanceShiftItemID, we.AttendanceTimeInterpretationID
		        ORDER BY Hour, CASE SOrEType WHEN 'S' THEN 0 ELSE 1 END
		    ) AS NextHour
		FROM WindowEvents_Net we
	),
	-- =====================================================================
	-- شاخه‌ی ۲: هر RequestTypeID (مرخصی/مأموریت/درخواست‌پرسنلی) کاملاً مستقل
	-- از فینگرپرینت و از بقیه‌ی انواع، دقیقاً مثل قبل
	-- =====================================================================
	WindowRequestTypes AS (
		SELECT DISTINCT w.PersonelID, w.[Date], w.AttendanceShiftItemID, w.StartHour, w.EndHour, w.AttendanceTimeInterpretationID,
		       e.RequestTypeID
		FROM   InterpretationWindows w
		       JOIN #EntryAndExit e
		            ON  e.PersonelID = w.PersonelID
		            AND e.Date = w.[Date]
		            AND e.AttendanceShiftItemID = w.AttendanceShiftItemID
		WHERE  e.RequestTypeID <> -1
	),
	StartState AS (
		SELECT wr.PersonelID, wr.[Date], wr.AttendanceShiftItemID, wr.StartHour, wr.EndHour, wr.AttendanceTimeInterpretationID, wr.RequestTypeID,
		       x.SOrEType AS StateBeforeWindow
		FROM   WindowRequestTypes wr
		       OUTER APPLY (
		           SELECT TOP 1 e.SOrEType
		           FROM   #EntryAndExit e
		           WHERE  e.PersonelID = wr.PersonelID
		                  AND e.Date = wr.[Date]
		                  AND e.AttendanceShiftItemID = wr.AttendanceShiftItemID
		                  AND e.RequestTypeID = wr.RequestTypeID
		                  AND e.Hour < wr.StartHour
		           ORDER BY e.Hour DESC
		       ) x
	),
	WindowEvents AS (
		SELECT ss.PersonelID, ss.[Date], ss.AttendanceShiftItemID, ss.StartHour, ss.EndHour,
		       e.Hour, e.SOrEType,ss.AttendanceTimeInterpretationID, ss.RequestTypeID
		FROM   StartState ss
		       JOIN #EntryAndExit e
		            ON  e.PersonelID = ss.PersonelID
		            AND e.Date = ss.[Date]
		            AND e.AttendanceShiftItemID = ss.AttendanceShiftItemID
		            AND e.RequestTypeID = ss.RequestTypeID
		            AND e.Hour >= ss.StartHour AND e.Hour < ss.EndHour

		UNION ALL

		-- اگر لحظه‌ی شروعِ بازه "داخل" بوده، یک S مصنوعی می‌سازیم
		SELECT ss.PersonelID, ss.[Date], ss.AttendanceShiftItemID, ss.StartHour, ss.EndHour,
		       ss.StartHour, 'S',ss.AttendanceTimeInterpretationID, ss.RequestTypeID
		FROM   StartState ss
		WHERE  ISNULL(ss.StateBeforeWindow, 'E') = 'S'
	),
	Ordered AS (
		SELECT
		    PersonelID, [Date], AttendanceShiftItemID, StartHour, EndHour, Hour, SOrEType,
		    we.AttendanceTimeInterpretationID, we.RequestTypeID,
		    LEAD(Hour, 1, EndHour) OVER (
		        PARTITION BY PersonelID, [Date], AttendanceShiftItemID,we.AttendanceTimeInterpretationID,we.RequestTypeID
		        ORDER BY Hour, CASE SOrEType WHEN 'S' THEN 0 ELSE 1 END
		    ) AS NextHour
		FROM WindowEvents we
	)
	INSERT INTO #TimeInterpretation
	(
		AttendanceTimeInterpretationID,
		PersonelID,
		[Date],
		AttendanceShiftItemID,
		StartHour,
		EndHour,
		AttendanceTime
	)

	SELECT
	CONCAT('P8_',AttendanceTimeInterpretationID,'_-1_-8') ,
	    PersonelID,
	    [Date],
	    AttendanceShiftItemID,
	    StartHour,
	    EndHour,
	    SUM(CASE WHEN SOrEType = 'S' THEN NextHour - Hour ELSE 0 END) AS AttendanceTime
	FROM   Ordered_Net
	GROUP BY PersonelID, [Date], AttendanceShiftItemID, StartHour, EndHour, AttendanceTimeInterpretationID

	UNION ALL

	SELECT
	CONCAT('P8_',AttendanceTimeInterpretationID,'_',RequestTypeID,'_-8') ,
	    PersonelID,
	    [Date],
	    AttendanceShiftItemID,
	    StartHour,
	    EndHour,
	    SUM(CASE WHEN SOrEType = 'S' THEN NextHour - Hour ELSE 0 END) AS AttendanceTime
	FROM   Ordered
	GROUP BY PersonelID, [Date], AttendanceShiftItemID, StartHour, EndHour, AttendanceTimeInterpretationID, RequestTypeID
				------------------ToDo
	
	
	
	END
	
	  SELECT @TimeInterpretationColumns = STUFF(
	               (
	                   SELECT * FROM (
	                   SELECT DISTINCT ',[P8_' + cast(ati.AttendanceTimeInterpretationID as NVARCHAR(200))+N'_-1_-8]' ParamTitle
	                   FROM   atn.AttendanceTimeInterpretation AS ati
	                   UNION ALL
	                    SELECT DISTINCT ',[P8_' + cast(ati.AttendanceTimeInterpretationID as NVARCHAR(200))+N'_'+cast(rt.RequestTypeID as NVARCHAR(250))+N'_-8]'
	                   FROM   atn.RequestType AS rt
	                   cross join atn.AttendanceTimeInterpretation AS ati 
	                   ) a
	                   
	                          FOR XML PATH(''),TYPE
	               ).value('.', 'NVARCHAR(MAX)'),
	               1,
	               1,
	               ''
	           )
	    
	    IF @TimeInterpretationColumns is null
	        SET @TimeInterpretationColumns = '[-1000]'
	        
	
	

DECLARE @InterPretationTable NVARCHAR(MAX)
set @InterPretationTable = cfg.getTempTableName(1)
	
	
set @Query = N' SELECT [Date], AttendanceShiftItemID, PersonelID, ' + @TimeInterpretationColumns + N' into '+@InterPretationTable+N'
FROM
(
    SELECT [Date], AttendanceShiftItemID, PersonelID, AttendanceTimeInterpretationID, AttendanceTime
    FROM #TimeInterpretation
) x  PIVOT
(
    Max(AttendanceTime)
    FOR AttendanceTimeInterpretationID IN (' + @TimeInterpretationColumns + N')
) p
'

EXEC sp_executesql @Query





	
	DECLARE @JustificationParams NVARCHAR(MAX),
			@ConstantParams NVARCHAR(MAX)
	
	

	
	set @JustificationParams =  STUFF(
	           (
	               SELECT DISTINCT ',[P6_-6_' + CAST(ap.AttendanceParameterID AS VARCHAR(100)) + '_-8]'
	               FROM   atn.AttendanceParameter AS ap
	               WHERE ap.[Type] = 1
	               
	                      FOR XML PATH(''),
	                      TYPE
	           ).value('.', 'NVARCHAR(MAX)'), 1,  1,   '')

	set @ConstantParams =  STUFF(
	           (
	               SELECT DISTINCT ',[P6_-6_' + CAST(ap.AttendanceParameterID AS VARCHAR(100)) + '_-8]'
	               FROM   atn.AttendanceParameter AS ap
	               WHERE ap.[Type] = 3
	               
	                      FOR XML PATH(''),
	                      TYPE
	           ).value('.', 'NVARCHAR(MAX)'), 1,  1,   '')	           
	           

DECLARE @JustificationTableData     NVARCHAR(MAX),
        @ConstantParameterData      NVARCHAR(MAX)

set @JustificationTableData = cfg.getTempTableName(1)
set @ConstantParameterData = cfg.getTempTableName(1)
	
	set @Query = N'
	SELECT *
	into '+@JustificationTableData+N'
	 FROM (
	SELECT jr.PersonelID,jr.[EffectiveDate],''P6_-6_''+CAST(jr.AttendanceParameterID as NVARCHAR(MAX))+''_-8'' AttendanceParameterID ,jr.[Value]
	 FROM atn.JustificationRegistration AS jr
	where jr.EffectiveDate between @StartDate 
	 and @CalcDate ) x
	 pivot (		max([Value])
		for x.AttendanceParameterID IN ('+@JustificationParams+N'))piv'

		----print @Query
		
	EXECUTE sp_executeSQL 
	        @Query,
	     N'@StartDate Date,
		   @CalcDate Date',
	     @StartDate = @StartDate,
	     @CalcDate = @CalcDate


---Generate Constant ParameterData	
SELECT                              
       opi.* ,dd.EffectiveDate,dd.AttendanceShiftItemID
INTO   #OtherPersonnelInformation
FROM   hrm.OtherPersonnelInformation  AS opi
join #PersonnelDate AS dd on dd.[EffectiveDate] between  opi.FromDate and ISNULL(opi.ToDate,'2060-12-20')

	set @Query = N'
	SELECT *
	into '+@ConstantParameterData+N'
	 FROM (
	SELECT jr.PersonelID,jr.[EffectiveDate],jr.AttendanceShiftItemID,''P6_-6_''+CAST(jr.AttendanceParameterID as NVARCHAR(MAX))+''_-8'' AttendanceParameterID ,jr.[Value]
	 FROM #OtherPersonnelInformation AS jr) x
	 pivot (		max([Value])
		for x.AttendanceParameterID IN ('+@ConstantParams+N')
		)piv'
	
		EXEC (@Query)
		



	
	DECLARE @UpdateJustificationParameter NVARCHAR(MAX),
			@UpdateConstantParameter NVARCHAR(MAX)
	
	
	set @UpdateJustificationParameter =  STUFF(
	           (
	    SELECT DISTINCT ',a.[P6_-6_' + CAST(ap.AttendanceParameterID AS VARCHAR(100)) + '_-8] =b.[P6_-6_' + CAST(ap.AttendanceParameterID AS VARCHAR(100)) + '_-8]'
	    FROM   atn.AttendanceParameter AS ap
	    WHERE ap.[Type] =  1
	               
	            FOR XML PATH(''),
	            TYPE
	           ).value('.', 'NVARCHAR(MAX)'), 1,  1,   '')
	
	set @UpdateConstantParameter =  STUFF(
	           (
	    SELECT DISTINCT ',a.[P6_-6_' + CAST(ap.AttendanceParameterID AS VARCHAR(100)) + '_-8] =b.[P6_-6_' + CAST(ap.AttendanceParameterID AS VARCHAR(100)) + '_-8]'
	    FROM   atn.AttendanceParameter AS ap
	    WHERE ap.[Type] =  3
	               
	            FOR XML PATH(''),
	            TYPE
	           ).value('.', 'NVARCHAR(MAX)'), 1,  1,   '')	
		
	IF @AttendanceParameterForCreateTable IS NULL
	    SET @AttendanceParameterForCreateTable = '[-1] decimal(36,10)'
	
		IF @InterpretationParametersForCreateTable IS NULL
	    SET @InterpretationParametersForCreateTable = '[-1000] decimal(36,10)'
	
	
	SET @Query = N'		
	create table ' + @CalcTable +
	    '
	(PersonelID int,
	 AttendanceShiftItemID int,
	 Date Date,
	 [P5_-6] decimal(36,10), --ساعت شروع شیفت
	 [P5_-7] decimal(36,10), --ساعت پایان شیفت
	 [P1_-1] decimal(36,10), --ساعت ورود
	 [P1_-2] decimal(36,10), --ساعت خروج
	 [P3_-1] int, --نوع استخدام
	 [P5_-14] bit, -- روز تعطیل
	 [P5_-15] bit, --روز ماموریت
	 [P5_-12] decimal(36,10), --زمان استاندارد شیفت
	 [P5_-13] decimal(36,10), --زمان دارای کارکرد
	 [P5_-18] decimal(36,10), --زمان دارای کارکرد در محدوده شیفت
	 [P5_-19] decimal(36,10), --مبلغ سفارش
	 [P5_-20] decimal(36,10), --بازه مرخصی
	 [P5_-21] int , -- تعطیل رسمی
	 [P5_-22] int, -- تعطیل شیفت,
	 [P5_-23] int,--زمان دارای کارکرد بعد از شیفت	 
	 [P5_-24] int,--زمان دارای کارکرد قبل از شیفت
	 [P5_-25] bit, --روز جمعه
	' + @AttendanceParameterForCreateTable + ','+@InterpretationParametersForCreateTable+N'
	)
	'
	
	EXEC (@Query)
	


    
	    
	    SELECT vpsid.PersonelID,
	           DATE,
	           vas.StartDate,
	           vas.AttendanceShiftItemID,
	           vpsid.AttendanceShiftID,
	           vas.StartingLimitHour,
	           vas.EndingLimitHour
	    INTO   #personelShift
	    FROM   #vwPersonelShiftInDate   AS vpsid
	           JOIN #vwAttendanceShift  AS vas
	                ON  vpsid.AttendanceShiftID = vas.AttendanceShiftID
	                AND vpsid.[Date] = vas.StartDate

	    
	    SELECT eae.PersonelID,
	           vpsid.AttendanceShiftItemID,
	           vpsid.StartDate
	    INTO   #PersonelOddEntryAndExitInDate
	    FROM   atn.EntryAndExit     AS eae
	           JOIN #personelShift  AS vpsid
	                ON  eae.PersonelID = vpsid.PersonelID
	                AND DATEDIFF(minute, '1970-01-01', eae.[Date]) + hour between vpsid.StartingLimitHour and 
	                    vpsid.EndingLimitHour
	    
	    GROUP BY
	           eae.PersonelID,
	           vpsid.AttendanceShiftItemID,
	           vpsid.StartDate
	    HAVING COUNT(*)%2 <> 0 
	   
	   declare @Personels nvarchar(max)
        SELECT @Personels = STUFF(
        (
            SELECT DISTINCT
                    ',' + b.Code + ':'+cfg.GetCLRSaturnDate(a.StartDate,'YYYY/MM/DD',0,0)+char(10)+char(13)
            FROM #PersonelOddEntryAndExitInDate a
			join hrm.Personel b on a.PersonelID = b.PersonelID
            FOR XML PATH(''), TYPE
        ).value('.', 'NVARCHAR(MAX)'),1   ,1   ,'');

	   if @Personels is not null
	   and @CallFromPerformanceReport = 0
	   BEGIN
	   	set @ErrorMessage = N'برای کدهای پرسنلی زیر در تاریخهای مشخص شده کارکرد ناقص است: '+char(10)+char(13)	+@Personels
	    RAISERROR (@ErrorMessage, 16, 10)
	    RETURN
		   END
	

	--select * from #PersonnelDate
		--select * from #vwPersonelStatusInDate

	----select @StartDate,@CalendarMonthEndDate

----print 'a1'
	SET @Query = N'
	insert into ' + @CalcTable +
	    '(PersonelID,AttendanceShiftItemID,Date,[P5_-6],[P5_-7],[P1_-1],[P1_-2],[P3_-1],[P5_-14],[P5_-15],[P5_-12],[P5_-13],[P5_-18],[P5_-19],[P5_-20],[P5_-21],[P5_-22],[P5_-23],[P5_-24],[P5_-25],'+@TimeInterpretationColumns+N')
	select 
		ps.personelid,
		ps.AttendanceShiftItemID,
		ps.EffectiveDate,
		case when ps.StartHour>0 then  ps.StartHour - DateDiff(minute,''1970-01-01'',ps.EffectiveDate) else 0 end  [P5_-6],
		case when ps.EndHour>0 then  ps.EndHour -DateDiff(minute,''1970-01-01'',ps.EffectiveDate) else 0 end [P5_-7],
		 [Entry] - DateDiff(minute,''1970-01-01'',ps.EffectiveDate)  [P1_-1],
		 [Exit] - DateDiff(minute,''1970-01-01'',ps.EffectiveDate) [P1_-2],
		EmploymentTypeID [P3_-1],
		case when ps.Holiday = 1 or ps.IsWorkingDay = 0 then 1 else 0 end [P5_-14],
		ps.MissionDay [P5_-15],
		ps.ShiftEndingHour - ps.ShiftStartingHour [P5_-12],
		DiffTime [P5_-13],
		case when DiffTimeInShift > (ps.EndHour - ps.StartHour) then ps.EndHour - ps.StartHour else DiffTimeInShift end [P5_-18],
		isnull(fo.Amount,0) [P5_-19],
		case when ps.VacancyDuration > (ps.EndHour - ps.StartHour) then ps.EndHour - ps.StartHour else VacancyDuration end [P5_-20],
		ps.FormalHoliday [P5_-21], 
		ps.ShiftHoliday [P5_-22] ,
		ee.	DiffTimeAfterShift [P5_-23],ee.DiffTimeBeforeShift [P5_-24],ps.IsFriday [P5_-25],'+@TimeInterpretationColumns+N'
		
		
	from #PersonnelDate ps
	join #vwPersonelStatusInDate vpsid on ps.PersonelID = vpsid.PersonelID and ps.EffectiveDate = vpsid.Date 
	left join
		(
			select  PersonelID,
					Date,
					AttendanceShiftItemID,
					MIN([Hour])  [Entry],
					max([Hour])  [Exit],
					sum(DiffTime) DiffTime,
					sum(DiffTimeInShift) DiffTimeInShift,
					sum(DiffTimeAfterShift) DiffTimeAfterShift,
					sum(DiffTimeBeforeShift) DiffTimeBeforeShift
			from #EntryAndExit
			group by PersonelID,Date,AttendanceShiftItemID
		) EE on EE.PersonelID = ps.PersonelID and EE.Date = ps.EffectiveDate and ps.AttendanceShiftItemID = ee.AttendanceShiftItemID
	left join #Agreement ag on ag.PersonelID = ps.PersonelID and ag.Rno = 1
	left join #Food fo on fo.PersonnelID = ps.PersonelID  and fo.Date = ps.EffectiveDate
	left join '+@InterPretationTable+N' ti on ps.PersonelID = ti.PersonelID and ps.AttendanceShiftItemID = ti.AttendanceShiftItemID and ps.EffectiveDate = ti.Date
	
	where ps.CalcDate between @StartDate and @CalcDate'



	EXECUTE sp_executeSQL 
	        @Query,
	     N'@StartDate Date,
		   @CalcDate Date',
	     @StartDate = @StartDate,
	     @CalcDate = @CalcDate

	

----update CalcTable For JustificationParameter
	
	set @Query  = N'UPDATE a set  ' + @UpdateJustificationParameter + N' FROM '+@CalcTable+N' a
	join '+@JustificationTableData+N' b on a.PersonelID = b.PersonelID and a.Date = b.EffectiveDate'

	EXEC (@Query)
	

	--- update CalcTable For Constant Parameters
	set @Query  = N'UPDATE a set  ' + @UpdateConstantParameter + N' FROM '+@CalcTable+N' a
	join '+@ConstantParameterData+N' b on a.PersonelID = b.PersonelID and a.Date = b.EffectiveDate'

	EXEC (@Query)
	
	    DECLARE @LeaveTypeColumn NVARCHAR(MAX)
	    DECLARE @LeaveTypeCreateColumn NVARCHAR(MAX)
	    
	    SELECT @LeaveTypeColumn = STUFF(
	               (
	                   SELECT DISTINCT ',' + QUOTENAME(RequestTypeID)
	                   FROM   ATN.RequestType
	                   WHERE  [Type] = 1
	                          FOR XML PATH(''),TYPE
	               ).value('.', 'NVARCHAR(MAX)'),
	               1,
	               1,
	               ''
	           )
	    
	    SELECT @LeaveTypeCreateColumn = STUFF(
	               (
	                   SELECT DISTINCT ',[P4_-3_' + CAST(RequestTypeID AS VARCHAR(50)) + '_-8] Int'
	                   FROM   ATN.RequestType
	                   WHERE  [Type] = 1
	                          FOR XML PATH(''),TYPE
	               ).value('.', 'NVARCHAR(MAX)'),
	               1,
	               1,
	               ''
	    )
	    
	    
	    IF @LeaveTypeCreateColumn IS NULL
	        SET @LeaveTypeCreateColumn = '[-1] int'
	    
	    SET @Query = N'
		create table ' + @LeaveTable + '
		(
		PersonelID int,
		Date Date,
		AttendanceShiftItemID int,
		' + @LeaveTypeCreateColumn + '
		)
		'
	    
	    EXEC (@Query)
	    
	    SET @Query = N'
		insert into ' + @LeaveTable + '
		select PersonelID,Date,AttendanceShiftItemID,' + @LeaveTypeColumn + 
	        ' 
		from
		(
		select lr.PersonelID,c.Date,c.AttendanceShiftItemID,RequestTypeID,SUM(case when StartHour is not null then EndHour - StartHour
												else [P5_-20]
												end
											) [Value]
		from ATN.LeaveRequest lr
		join cfg.dimdate dd on dd.date between lr.StartDate and lr.enddate
		join ' + @CalcTable +
	        ' c on c.PersonelID = lr.PersonelID and dd.date = c.date
		where Status = 2
		and dd.Date between @StartDate and @CalcDate
		group by lr.PersonelID,c.Date,c.AttendanceShiftItemID,RequestTypeID
		)x
		pivot
		(
		max([Value])
		for RequestTypeID in (' + @LeaveTypeColumn + ')
		)piv
		'
	    
	    EXECUTE sp_executeSQL 
	            @Query,
	         N'@StartDate Date,
					  @CalcDate Date',
	         @StartDate = @StartDate,
	         @CalcDate = @CalcDate
			 	 
	

	
	--------------Update Interpretation

			 
	CREATE TABLE #AT1
	(
		AttendanceParameterID     INT,
		Calculated                BIT,
		SQLCondition              VARCHAR(1024),
		SQLExpression             VARCHAR(1024),
		Deferred                  BIT,
		FormulaID                 INT,
		SDate                     DATE,
		EDate                     DATE
	)

	
	INSERT INTO #AT1(
	           AttendanceParameterID,
	           Calculated,
	           SQLCondition,
	           SQLExpression,
	           Deferred,
	           FormulaID,
	           SDate,
	           EDate
	       )
	SELECT AttendanceParameterID,
	       0,
	       SQLCondition,
	       SQLExpression,
	       Deferred,
	       FormulaID,
	       SDate,
	       EDate
	FROM   #AttendanceParameter
	WHERE  FormulaID NOT IN (SELECT AttendanceCalculationMethodFormulaID
	                         FROM   atn.AttendanceCalculationMethodFormulaParameter
	                         WHERE  Category = -6)
	GROUP BY
	       AttendanceParameterID,
	       SQLCondition,
	       SQLExpression,
	       Deferred,
	       FormulaID,
	       SDate,
	       EDate
	
	
	SELECT AttendanceParameterID,
	       0 Calculated,
	       FormulaID
	INTO   #All_AttendanceParameter
	FROM   #AttendanceParameter
	
	DECLARE @a INT = 0
	DECLARE @SDate DATE
	DECLARE @EDate DATE
	
	
	
	WHILE EXISTS (
	          SELECT *
	          FROM   #AT1
	          WHERE  Calculated = 0
	      )
	BEGIN
	    SET @a = @a + 1
	    
	    DECLARE Calc_Attendance CURSOR 
	    FOR
	        SELECT AttendanceParameterID,
	               SQLCondition,
	               SQLExpression,
	               Deferred,
	               FormulaID,
	               SDate,
	               EDate
	        FROM   #AT1 a
	        WHERE  Calculated = 0
	        ORDER BY
	               AttendanceParameterID,
	               SDate
	
	    OPEN Calc_Attendance 
	    FETCH NEXT FROM Calc_Attendance INTO @ParameterID,
	       @SQLCondition,
	       @SQLExpression,
	       @Deferred,
	       @FormulaID,
	       @SDate,
	       @EDate
	       
		   	
	WHILE @@FETCH_STATUS = 0
	BEGIN
	    IF @SQLCondition IS NULL
	        SET @SQLCondition = '1 = 1'
	   ----print 'a4'   
	    SET @Query = N'
			update a
			set [P6_-6_' + @ParameterID + '_-8] = case when ' + @SQLCondition + ' then ' + @SQLExpression +
	        ' else [P6_-6_' + @ParameterID + '_-8]  end
			from ' + @CalcTable + ' a'+
			CASE WHEN @GroupSelect is NOT NULL then N'  left join ' + @GroupAssignmentTable +' ga on ga.PersonelID = a.PersonelID' else '' END+N'
			left join  ' + @LeaveTable + ' l on l.PersonelID = a.PersonelID and l.date = a.date and a.AttendanceShiftItemID = l.AttendanceShiftItemID
			where 
			(
				(@Deferred= 0 and a.Date between  @StartDate and @CalcDate)
				or
				(@Deferred = 1)
			)
			and a.date between @SDate and @EDate
			'
	  ----print 'a5'
	    


	    EXECUTE sp_executeSQL 
	            @Query,
	         N'@StartDate Date,
					@CalcDate  Date,
					@Deferred bit,
					@SDate    Date,
					@EDate    Date',
	         @StartDate = @StartDate,
	         @CalcDate = @CalcDate,
	         @Deferred = @Deferred,
	         @SDate = @SDate,
	         @EDate = @EDate
	  
	    ------print 'a6'
	    UPDATE #AT1
	    SET    Calculated = 1
	    WHERE  FormulaID = @FormulaID
	    
	    UPDATE #All_AttendanceParameter
	    SET    Calculated = 1
	    WHERE  FormulaID = @FormulaID
	    
	    FETCH NEXT FROM Calc_Attendance INTO @ParameterID,
	       @SQLCondition,
	       @SQLExpression,
	       @Deferred,
	       @FormulaID,
	       @SDate,
	       @EDate
	
	END 
	
	CLOSE Calc_Attendance 
	DEALLOCATE Calc_Attendance 
	
	
	
	INSERT INTO #AT1(
	           AttendanceParameterID,
	           Calculated,
	           SQLCondition,
	           SQLExpression,
	           Deferred,
	           FormulaID,
	           SDate,
	           EDate
	       )
	SELECT AttendanceParameterID,
	       0,
	       a.SQLCondition,
	       a.SQLExpression,
	       Deferred,
	       FormulaID,
	       SDate,
	       EDate
	FROM   (
	           SELECT a.AttendanceParameterID,
	                  a.SQLCondition,
	                  a.SQLExpression,
	                  Deferred,
	                  FormulaID,
	                  SDate,
	                  EDate
	           FROM   #AttendanceParameter a
	                  JOIN atn.AttendanceCalculationMethodFormulaParameter b
	                       ON  a.FormulaID = b.AttendanceCalculationMethodFormulaID
	                       AND Category = -6
	           WHERE  a.FormulaID NOT IN (SELECT FormulaID
	                                      FROM   #AT1
	                                      WHERE  Calculated = 1)
	                  AND FormulaID NOT IN (SELECT AttendanceCalculationMethodFormulaID
	                                        FROM   atn.AttendanceCalculationMethodFormulaParameter a
	                                               JOIN #All_AttendanceParameter b
	                                                    ON  a.Parameter = b.AttendanceParameterID
	                                        WHERE  Category = -6
	                                               AND Calculated = 0)
	       )a
	GROUP BY
	       a.AttendanceParameterID,
	       a.SQLCondition,
	       a.SQLExpression,
	       Deferred,
	       FormulaID,
	       SDate,
	       EDate
	
	END
	
	--EXEC (N'update '+@CalcTable + N'
	--set [P5_-6] =  [P5_-6] - case when [P5_-6]>0 then datediff(minute,''1970-01-01'',Date) else 0 end,
	--[P5_-7] = [P5_-7] - case when [P5_-7]>0 then datediff(minute,''1970-01-01'',Date)  else  0 end')
	
	IF @CallFromPerformanceReport = 1
	BEGIN
    
	    set @Query = 
	             N'
		select a.*,case when b.PersonelID is  null then 1 else 0 end IsComplete
		into ' + @performanceReportTable + '
		from ' + @calcTable + 
	             ' a
		left join #PersonelOddEntryAndExitInDate b on a.PersonelID = b.PersonelID and a.Date = b.StartDate
		order by a.date
		'	
	   EXEC (@Query)

	
	      
	    RETURN
	END
	

	
	INSERT INTO [ATN].[AttendanceCalculationPersonnel]
	       (
	           [PersonelID],
	           [CalendarMonthID],
	           [ToDate],
	           [CalculationDate],
	           [Version],
	           [Creator],
	           [CreationDate],
	           [LastEditor],
	           [LastEditionDate],
	           [Status]
	       )
	SELECT [PersonelID],
	       @CalendarMonthID,
	       @CalcDate,
	       GETDATE(),
	       0,
	       @CreatorID,
	       GETDATE(),
	       @CreatorID,
	       GETDATE(),
	       CASE WHEN @CalcType = 2 then 3 else 1 end
	FROM   #selPersonel
	
	DECLARE Insert_Attendance CURSOR 
	FOR
	    SELECT AttendanceParameterID
	    FROM   #AttendanceParameter
	    GROUP BY
	           AttendanceParameterID
	
	OPEN Insert_Attendance 
	FETCH NEXT FROM Insert_Attendance INTO @ParameterID
	
	WHILE @@FETCH_STATUS = 0
	BEGIN
	    SET @Query = 
	        N'
		INSERT INTO [ATN].[AtnParameterCalculationResult]
				   ([AttendanceCalculationPersonnelID]
				   ,[AttendanceParameterID]
				   ,[Date]
				   ,[Value]
				   ,[Version]
				   ,[Creator]
				   ,[CreationDate]
				   ,[LastEditor]
				   ,[LastEditionDate]
				   ,[AttendanceShiftItemID])
		select		[AttendanceCalculationPersonnelID]
				   ,' + @ParameterID + '
				   ,[Date]
				   ,isnull([P6_-6_' + @ParameterID + 
	        '_-8],0)
				   ,0
				   ,@CreatorID
				   ,GETDATE()
				   ,@CreatorID
				   ,GETDATE()
				   ,AttendanceShiftItemID
		from ' + @CalcTable + 
	        ' a
		join [ATN].[AttendanceCalculationPersonnel] b
			on a.PersonelID = b.PersonelID and b.[CalendarMonthID] = @CalendarMonthID		
		where isnull([P6_-6_' + @ParameterID + '_-8],0) <> 0
		'
	    
	    EXECUTE sp_executeSQL 
	            @Query,
	         N'@CreatorID int,
					  @CalendarMonthID int',
	         @CreatorID = @CreatorID,
	         @CalendarMonthID = @CalendarMonthID
	    
	    FETCH NEXT FROM Insert_Attendance INTO @ParameterID
	
	END 
	
	CLOSE Insert_Attendance 
	DEALLOCATE Insert_Attendance 
	
	
	DECLARE @VacancyTable NVARCHAR(MAX)
	set @VacancyTable = cfg.getTempTableName(1)

--Get Vacancy Balance 

	SELECT * into #EmploymentDatePerPersonel
FROM hrm.vwPersonelEmplomentDatePerMonth AS vpedpm
WHERE vpedpm.CalendarMonthID = @CalendarMonthID


declare @VacancyData nvarchar(Max)
set @VacancyData = cfg.getTempTableName(1)

exec atn.spVacancyCardex
@VacancyTable
create table #vwVacancy
(
PersonelID int,VacancyNatureID int, Balance int)

EXEC atn.spVacancyCardex
	@VacancyTable = @VacancyData

set @Query = N'
insert into #vwVacancy
(PersonelID,VacancyNatureID,Balance)
SELECT vvc.PersonelID,vvc.VacancyNatureID,SUM(vvc.AddedVacancy-vvc.DeductedVacancy) Balance
FROM '+@VacancyData+N' AS vvc
join #selPersonel sp on vvc.PersonelID = sp.PersonelID
join #EmploymentDatePerPersonel edp on sp.PersonelID = edp.PersonelID  and vvc.EmploymentDate = edp.EmploymentDate
WHERE vvc.[Date] <=@CalcDate
GROUP BY vvc.PersonelID,vvc.VacancyNatureID'

    
	    EXECUTE sp_executeSQL 
	            @Query,
	         N'@CalcDate Date',
	         @CalcDate = @CalcDate

-- End of Get VacancyBalance
-- Insert Vacancy Balance Parameters into CalculationResult


	
		INSERT INTO atn.PayParameterCalculationResult
		(
			-- PayParameterCalculationResultID -- this column value is auto-generated
			ParameterID,
			AttendanceParameterID,
			[Value],
			Version,
			Creator,
			CreationDate,
			LastEditor,
			LastEditionDate,
			AttendanceCalculationPersonnelID
		)
		
		
		SELECT Null,ap.AttendanceParameterID,vt.Balance,0,@CreatorID,GETDATE(),@CreatorID,GETDATE(),acp1.AttendanceCalculationPersonnelID
		 FROM #vwVacancy vt
		join atn.VacancyNature		 AS vn on vt.VacancyNatureID = vn.VacancyNatureID
		join atn.AttendanceParameter AS ap on ap.AttendanceParameterID = vn.AttendanceParameterID
		join atn.AttendanceCalculationPersonnel AS acp1 on vt.PersonelID = acp1.PersonelID
		WHERE acp1.CalendarMonthID = @CalendarMonthID
		
		
	-- End of  Insert Vacancy Balance Parameters into CalculationResult	
	


	
	SELECT MethodID,
	       ISNULL(ParameterID,AttendanceParameterID) ParameterID,
	       f.AttendanceCalculationMethodFormulaID FormulaId,
	       f.SQLCondition,
	       f.SQLExpression,
	       CASE WHEN t.ParameterID is NOT NULL then 1 Else 0 END IsPayParameter
	INTO   #MonthParameters
	FROM   (
	           SELECT acm.AttendanceCalculationMethodID MethodID,
	                  p.ParameterID,
	                  ROW_NUMBER() OVER(
	                      PARTITION BY ISNULL(acm.ParameterID,acm.AttendanceParameterID) ORDER BY cm.AttendanceEndDate DESC
	                  ) AS Rno,
	                  ap.AttendanceParameterID
	           FROM   ATN.AttendanceCalculationMethod acm
	                  Left JOIN PAY.Parameter p
	                       ON  p.ParameterID = acm.ParameterID	                       
	                  left join atn.AttendanceParameter AS ap on ap.AttendanceParameterID = acm.AttendanceParameterID 
	                  left join atn.VacancyNature AS vn on vn.AttendanceParameterID = ap.AttendanceParameterID
	                  left JOIN hrm.CalendarMonth cm  on cm.CalendarMonthID = acm.CalendarMonthID   
	           WHERE  ISNULL(acm.[Date],cm.StartDate)<=@CalcDate and (p.ParameterID  is NOT NULL or ap.TimingMethod = 2) 
	           and vn.VacancyNatureID is NULL
	       ) T
	       LEFT JOIN ATN.AttendanceCalculationMethodFormula f
	            ON  f.AttendanceCalculationMethodID = T.MethodID
	            
	WHERE  Rno = 1
	
	
	IF EXISTS (
	       SELECT 1
	       FROM   #MonthParameters
	   )
	BEGIN
	    SELECT a.PersonelID,
	           COUNT(1) [P5_-17]
	    INTO   #absence
	    FROM   #PersonnelDate a
	           LEFT JOIN (
	                    SELECT PersonelID,
	                           DATE
	                    FROM   #EntryAndExit
	                    GROUP BY
	                           PersonelID,
	                           DATE
	                )b
	                ON  a.PersonelID = b.PersonelID
	                AND a.EffectiveDate = b.Date
	    WHERE  a.EffectiveDate BETWEEN @StartDate AND @CalcDate
	           AND ISNULL(a.Holiday, 0) = 0
	           AND a.IsWorkingDay = 1
	           AND b.PersonelID IS NULL
	    GROUP BY
	           a.PersonelID
	    
	    DECLARE @MissionTypeColumn NVARCHAR(MAX)
	    DECLARE @MissionTypeSelect NVARCHAR(MAX)
	    DECLARE @MissionTypeCreateColumn NVARCHAR(MAX)
	    
	    SELECT @MissionTypeCreateColumn = STUFF(
	               (
	                   SELECT DISTINCT ',[P7_-7_' + CAST(MissionTypeID AS VARCHAR(50)) + '_-8] Int'
	                   FROM   ATN.MissionType
	                          FOR XML PATH(''),
	                          TYPE
	               ).value('.', 'NVARCHAR(MAX)'),
	               1,
	               1,
	               ''
	           )
	    
	    IF @MissionTypeCreateColumn IS NULL
	        SET @MissionTypeCreateColumn = '[-1] int'
	    
	    SELECT @MissionTypeColumn = STUFF(
	               (
	                   SELECT DISTINCT ',' + QUOTENAME(MissionTypeID)
	                   FROM   ATN.MissionType
	                          FOR XML PATH(''),
	                          TYPE
	               ).value('.', 'NVARCHAR(MAX)'),
	               1,
	               1,
	               ''
	           )
	    
	    IF @MissionTypeColumn IS NULL
	        SET @MissionTypeColumn = '[-1]'
	    
	    SET @Query = N'
		create table ' + @MissionTable + '
		(
		PersonelID int,
		' + @MissionTypeCreateColumn + '
		)
		'
	    
	    EXEC (@Query)
	    
	    SET @Query = N'
		insert into ' + @MissionTable + '
		select PersonelID,' + @MissionTypeColumn +
	        ' 
		from
		(
		select PersonelID,MissionTypeID,SUM(DATEDIFF(day,StartDate,EndDate) + 1) [Value]
		from ATN.MissionReport
		where Status = 2
		and Date between @StartDate and @CalcDate
		group by PersonelID,MissionTypeID
		)x
		pivot
		(
		max([Value])
		for MissionTypeID in (' + @MissionTypeColumn + ')
		)piv
		'
	    
	    EXECUTE sp_executeSQL 
	            @Query,
	         N'@StartDate Date,
					  @CalcDate Date',
	         @StartDate = @StartDate,
	         @CalcDate = @CalcDate
	    

	    
	    DECLARE @PersonelRequestTypeColumn NVARCHAR(MAX)
	    DECLARE @PersonelRequestTypeCreateColumn NVARCHAR(MAX)
	    
	    SELECT @PersonelRequestTypeColumn = STUFF(
	               (
	                   SELECT DISTINCT ',' + QUOTENAME(RequestTypeID)
	                   FROM   ATN.RequestType
	                   WHERE  [Type] = 3
	                          FOR XML PATH(''),TYPE
	               ).value('.', 'NVARCHAR(MAX)'),
	               1,
	               1,
	               ''
	           )
	    
	    SELECT @PersonelRequestTypeCreateColumn = STUFF(
	               (
	                   SELECT DISTINCT ',[P4_-8_' + CAST(RequestTypeID AS VARCHAR(50)) + '_-8] int'
	                   FROM   ATN.RequestType
	                   WHERE  [Type] = 3
	                          FOR XML PATH(''),TYPE
	               ).value('.', 'NVARCHAR(MAX)'),
	               1,
	               1,
	               ''
	           )
	    
	    IF @PersonelRequestTypeCreateColumn IS NULL
	        SET @PersonelRequestTypeCreateColumn = '[-1] int'
	    
	    SET @Query = N'
		create table ' + @PersonelRequestTable + '
		(
		PersonelID int,
		' + @PersonelRequestTypeCreateColumn + '
		)
		'

	    EXEC (@Query)
	    
	    SET @Query = N'
		insert into ' + @PersonelRequestTable + '
		select PersonelID,' + @PersonelRequestTypeColumn + 
	        ' 
		from
		(
		select lr.PersonelID,RequestTypeID,SUM(case when StartHour is not null then EndHour - StartHour
												else [P5_-7] - [P5_-6]
												end
											) [Value]
		from ATN.PersonelRequest lr
		join cfg.dimdate dd on dd.date between lr.StartDate and lr.enddate
		join ' + @CalcTable +
	        ' c on c.PersonelID = lr.PersonelID and dd.date = c.date
		where Status = 2
		and dd.Date between @StartDate and @CalcDate
		group by lr.PersonelID,RequestTypeID
		)x
		pivot
		(
		max([Value])
		for RequestTypeID in (' + @PersonelRequestTypeColumn + ')
		)piv
		'
	    
	    EXECUTE sp_executeSQL 
	            @Query,
	         N'@StartDate Date,
					  @CalcDate Date',
	         @StartDate = @StartDate,
	         @CalcDate = @CalcDate
	    
	    
	    DECLARE @MissionRequestTypeColumn NVARCHAR(MAX)
	    DECLARE @MissionRequestCreateColumn NVARCHAR(MAX)
	    
	    SELECT @MissionRequestTypeColumn = STUFF(
	               (
	                   SELECT DISTINCT ',' + QUOTENAME(RequestTypeID)
	                   FROM   ATN.RequestType
	                   WHERE  [Type] = 2
	                          FOR XML PATH(''),TYPE
	               ).value('.', 'NVARCHAR(MAX)'),
	               1,
	               1,
	               ''
	           )
	    
	    SELECT @MissionRequestCreateColumn = STUFF(
	               (
	                   SELECT DISTINCT ',[P4_-4_' + CAST(RequestTypeID AS VARCHAR(50)) + '_-8] int'
	                   FROM   ATN.RequestType
	                   WHERE  [Type] = 2
	                          FOR XML PATH(''),TYPE
	               ).value('.', 'NVARCHAR(MAX)'),
	               1,
	               1,
	               ''
	           )
	    
	    IF @MissionRequestCreateColumn is null
	        SET @MissionRequestCreateColumn = '[-1] int'
	    
	    SET @Query = N'
		create table ' + @MissionRequestTable + '
		(
		PersonelID int,
		' + @MissionRequestCreateColumn + '
		)
		'
	    
	    EXEC (@Query)
	    
	    SET @Query = N'
		insert into ' + @MissionRequestTable + '
		select PersonelID,' + @MissionRequestTypeColumn + 
	        ' 
		from
		(
		select mr.PersonelID,mr.RequestTypeID,SUM(
												case when StartHour is not null then EndHour - StartHour
													else [P5_-7] - [P5_-6]
												end
												 ) [Value]
		from ATN.MissionRequest mr
		join cfg.dimdate dd on dd.date between mr.StartDate and mr.enddate
		join ' + @CalcTable +
	        ' c on c.PersonelID = mr.PersonelID and dd.date = c.date
		join ATN.RequestType rt on rt.RequestTypeID = mr.RequestTypeID
		where Status = 2 and timing = 1
		and dd.Date between @StartDate and @CalcDate
		group by mr.PersonelID,mr.RequestTypeID
		union all
		select mr.PersonelID,mr.RequestTypeID,SUM(DATEDIFF(day,StartDate,EndDate) + 1) [Value]
		from ATN.MissionRequest mr
		join ATN.RequestType rt on rt.RequestTypeID = mr.RequestTypeID
		where Status = 4 and timing = 2
		and EffectiveDate is not null and EffectiveDate between @StartDate and @CalcDate
		group by mr.PersonelID,mr.RequestTypeID
		)x
		pivot
		(
		max([Value])
		for RequestTypeID in (' + @MissionRequestTypeColumn + ')
		)piv
		'
		
	
	    
	    EXECUTE sp_executeSQL 
	            @Query,
	         N'@StartDate Date,
					  @CalcDate Date',
	         @StartDate = @StartDate,
	         @CalcDate = @CalcDate
	    
	    
	    
	    SELECT @AttendanceParameterColumns = STUFF(
	               (
	                   SELECT DISTINCT ',' + QUOTENAME(acm.AttendanceParameterID)
	                   FROM   atn.AttendanceCalculationMethod acm
	                   join atn.AttendanceParameter AS ap on ap.AttendanceParameterID = acm.AttendanceParameterID 
	                   WHERE  acm.AttendanceParameterID IS NOT NULL
	                   and ap.TimingMethod = 1
	                          FOR XML PATH(''),TYPE
	               ).value('.', 'NVARCHAR(MAX)'),
	               1,
	               1,
	               ''
	           )
	    
	    IF @AttendanceParameterColumns is null
	        SET @AttendanceParameterColumns = '[-1]'
	        
 
	        
	        
	    
	    SELECT @SelectAttendanceParameter = STUFF(
	               (
	                   SELECT DISTINCT ',[P6_-6_' + CAST(acm.AttendanceParameterID AS VARCHAR(10)) + '_-10]'
	                   FROM   atn.AttendanceCalculationMethod acm
	                   join atn.AttendanceParameter AS ap on ap.AttendanceParameterID = acm.AttendanceParameterID
	                   WHERE  acm.AttendanceParameterID IS NOT NULL
	                   and ap.TimingMethod = 1
	                          FOR XML PATH(''),TYPE
	               ).value('.', 'NVARCHAR(MAX)'),
	               1,
	               1,
	               ''
	           )
	    
	    IF @SelectAttendanceParameter is null
	        SET @SelectAttendanceParameter = '[-1]'
	    
	    SELECT @AttendanceParameterForCreateTable = STUFF(
	               (
	                   SELECT DISTINCT ',[P6_-6_' + CAST(acm.AttendanceParameterID AS VARCHAR(10)) + '_-10] decimal(36,10)'
	                   FROM   atn.AttendanceCalculationMethod acm
	                   join atn.AttendanceParameter AS ap on ap.AttendanceParameterID = acm.AttendanceParameterID	                   
	                   WHERE  acm.AttendanceParameterID IS NOT NULL
	                   and ap.TimingMethod = 1
	                          FOR XML PATH(''),TYPE
	               ).value('.', 'NVARCHAR(MAX)'),
	               1,
	               1,
	               ''
	    )
	    
		IF @AttendanceParameterForCreateTable is null
		SET @AttendanceParameterForCreateTable = '[-1] decimal(36,10)'
		
		
	    DECLARE @MonthlyAttendanceParametersForCreateTable NVARCHAR(MAX),
	            @SelectMonthlyAttendanceParameter NVARCHAR(MAX)
	    
	    SELECT @MonthlyAttendanceParametersForCreateTable = STUFF(
	               (
	                   SELECT DISTINCT ',[P6_-9_' + CAST(ap.AttendanceParameterID AS VARCHAR(10)) + 
	                          '_-8] decimal(36,10)'
	                   FROM    atn.AttendanceParameter AS ap
	                   left join atn.AttendanceCalculationMethod acm	                         
	                               ON  ap.AttendanceParameterID = acm.AttendanceParameterID
	                   left join atn.VacancyNature AS vn on vn.AttendanceParameterID = ap.AttendanceParameterID            
	                   WHERE  (acm.AttendanceParameterID IS NOT NULL or vn.AttendanceParameterID is NOT NULL)
	                          AND ap.TimingMethod = 2
	                              FOR XML PATH(''),TYPE
	               ).value('.', 'NVARCHAR(MAX)'),
	               1,
	               1,
	               ''
	           )
	    
	    IF @MonthlyAttendanceParametersForCreateTable is NULL
	        SET @MonthlyAttendanceParametersForCreateTable = N'[-100]  Decimal(36,10)'
	
	    
	    SELECT @SelectMonthlyAttendanceParameter = STUFF(
	               (
	                   SELECT DISTINCT ',[P6_-6_' + CAST(AttendanceParameterID AS VARCHAR(10)) + '_-10]'
	                   FROM   atn.AttendanceCalculationMethod
	                   WHERE  AttendanceParameterID IS NOT NULL
	                          FOR XML PATH(''),TYPE
	               ).value('.', 'NVARCHAR(MAX)'),
	               1,
	               1,
	               ''
	           )
	    
	    SELECT @PayrollParameterForCreateTable = STUFF(
	               (
	                   SELECT DISTINCT ',[P6_-5_' + CAST(ParameterID AS VARCHAR(10)) + '_-8] decimal(36,10)'
	                   FROM   atn.AttendanceCalculationMethod
	                   WHERE  ParameterID IS NOT NULL
	                          FOR XML PATH(''),TYPE
	               ).value('.', 'NVARCHAR(MAX)'),
	               1,
	               0,
	               ''
	           )
	    
	    IF @PayrollParameterForCreateTable is null
	        SET @PayrollParameterForCreateTable = '[-1] decimal(36,10)'
	    
	    SET @Query = N'		
		create table ' + @PCalcTable + '
		(PersonelID int,
		' + @AttendanceParameterForCreateTable +','+@MonthlyAttendanceParametersForCreateTable+ '
		' + @PayrollParameterForCreateTable + '
		)
		'
		--print @query
    
	    EXEC (@Query)
	    


	    

	    
	    SET @Query = N'	insert into ' + @PCalcTable + '	(PersonelID,' + @SelectAttendanceParameter + 
	        ')	
						select a.PersonelID,' + @AttendanceParameterColumns + 
	        '
						from #selPersonel a
						left join
						(
							select b.PersonelID,AttendanceParameterID,sum(Value) Value
							from atn.AtnParameterCalculationResult a
							join atn.AttendanceCalculationPersonnel b on a.AttendanceCalculationPersonnelID = b.AttendanceCalculationPersonnelID
							where b.CalendarMonthID = @CalendarMonthID
							group by b.PersonelID,AttendanceParameterID
						)x
						pivot
						(
							max(Value)
							for AttendanceParameterID in (' + @AttendanceParameterColumns + 
	        ')
						)p on a.PersonelID = p.PersonelID
						'
						
    EXECUTE sp_executeSQL 
	            @Query,
	         N'@CalendarMonthID int',
	         @CalendarMonthID = @CalendarMonthID
	         
	         
	         
--Update VacancyBalance
	    
DECLARE @VacancyBalanceParametersUpdate NVARCHAR(MAX)
	         
	         	    SELECT @VacancyBalanceParametersUpdate = STUFF(
	               (
	                   SELECT DISTINCT ',ct.[P6_-9_' + CAST(ap.AttendanceParameterID AS VARCHAR(10)) + 
	                          '_-8] =vt.['+CAST(ap.AttendanceParameterID AS VARCHAR(10))+']'
	                   FROM    atn.AttendanceParameter AS ap
	                    join atn.VacancyNature AS vn on vn.AttendanceParameterID = ap.AttendanceParameterID            
	                  FOR XML PATH(''),TYPE
	               ).value('.', 'NVARCHAR(MAX)'),
	               1,
	               1,
	               ''
	         	    )
	         	    
          
	         if @VacancyBalanceParametersUpdate is NOT NULL
	         BEGIN 	    
	         	    
	        DECLARE @VacancyParameters NVARCHAR(MAX)
	        
	            SELECT @VacancyParameters = STUFF(
	               (
	                   SELECT DISTINCT ',[' + CAST(ap.AttendanceParameterID AS VARCHAR(10)) + 
	                          ']'
	                   FROM    atn.AttendanceParameter AS ap
	                    join atn.VacancyNature AS vn on vn.AttendanceParameterID = ap.AttendanceParameterID            
	                  FOR XML PATH(''),TYPE
	               ).value('.', 'NVARCHAR(MAX)'),
	               1,
	               1,
	               ''
	         	    )	
	         	    
	         	 DECLARE @VacancyBalanceTable NVARCHAR(MAX)
	         	 set @VacancyBalanceTable = cfg.getTempTableName(1)       
	       
	       
	         	    
	        set @Query 	  =  N'
	       SELECT *  into '+@VacancyBalanceTable +N' FROM (
	       SELECT acp1.PersonelID ,ppcr.AttendanceParameterID,ppcr.[Value]  FROM atn.PayParameterCalculationResult AS ppcr
	       join atn.AttendanceCalculationPersonnel AS acp1 on acp1.AttendanceCalculationPersonnelID = ppcr.AttendanceCalculationPersonnelID
	       join #selPersonel sp on acp1.PersonelID = sp.PersonelID
	       WHERE acp1.CalendarMonthID = @CalendarMonthID
	      ) x
	       pivot (MAX(VALUE) for x.AttendanceParameterID IN ('+@VacancyParameters+N')) a '
	       
	    
	       EXECUTE sp_executeSql
	       @Query,
	       N'@CalendarMonthID int',
	       @CalendarMonthID = @CalendarMonthID
	     
	         	    
	       
	         	 set @Query = N'Update ct set '+@VacancyBalanceParametersUpdate + 
	         	 N'	     FROM ' + @PCalcTable+N' ct join '+@VacancyBalanceTable + ' vt on ct.PersonelID = vt.PersonelID'       
	         	  
 
	         
	         EXECUTE sp_executeSQl 
	         @Query,
	         N'@CalendarMonthID int',
	         @CalendarMonthID = @CalendarMonthID
	   
	         END
	         
--- End of Update VacancyBalance       	         
	         
	         
	 	    
	    SELECT @LeaveTypeCreateColumn = STUFF(
	               (
	                   SELECT DISTINCT ',SUM([P4_-3_' + CAST(RequestTypeID AS VARCHAR(50)) + '_-8]) [P4_-3_' + CAST(RequestTypeID AS VARCHAR(50)) + '_-8]'
	                   FROM   ATN.RequestType
	                   WHERE  [Type] = 1
	                          FOR XML PATH(''),TYPE
	               ).value('.', 'NVARCHAR(MAX)'),
	               1,
	               1,
	               ''
	           )
	    
	    IF @LeaveTypeCreateColumn IS NULL
	        SET @LeaveTypeCreateColumn = 'SUM([-1]) [-1]'	    
	    CREATE TABLE #T1
	    (
	    	ParameterID       INT,
	    	Calculated        BIT,
	    	SQLCondition      VARCHAR(1024),
	    	SQLExpression     VARCHAR(1024),
	    	FormulaID         INT,
	    	IsPayParameter TINYINT
	    )
	    
	    INSERT INTO #T1(
	               ParameterID,
	               Calculated,
	               SQLCondition,
	               SQLExpression,
	               FormulaID,
	               IsPayParameter
	           )
	    SELECT ParameterID,
	           0,
	           SQLCondition,
	           SQLExpression,
	           FormulaID,
	           IsPayParameter
	    FROM   #MonthParameters
	    WHERE  FormulaID NOT IN (SELECT AttendanceCalculationMethodFormulaID
	                             FROM   atn.AttendanceCalculationMethodFormulaParameter
	                             WHERE  Category = -5)
	    GROUP BY
	           ParameterID,
	           SQLCondition,
	           SQLExpression,
	           FormulaID,
	           IsPayParameter
	    
	    
	    SELECT ParameterID,
	           0 Calculated,
	           FormulaID,
	           IsPayParameter
	    INTO   #All_PayrollParameter
	    FROM   #MonthParameters
	    
	
	
	    
	    WHILE EXISTS (
	              SELECT *
	              FROM   #T1
	              WHERE  Calculated = 0
	    )
	    
	  
	            
	    BEGIN
	    	
 	
	        DECLARE Calc_Payroll CURSOR 
	        FOR
	            SELECT ParameterID,
	                   SQLCondition,
	                   SQLExpression,
	                   FormulaID,
	                   IsPayParameter
	            FROM   #T1 a
	            WHERE  Calculated = 0
	            
	            
	        
	        OPEN Calc_Payroll 
	        FETCH NEXT FROM Calc_Payroll 
	        INTO @ParameterID,
	           @SQLCondition,
	           @SQLExpression,
	           @FormulaID,
	           @IsPayParameter
	    WHILE @@FETCH_STATUS = 0
	    BEGIN
	        IF @SQLCondition IS NULL
	            SET @SQLCondition = '1 = 1'
	            
	            
	            
       
	        SET @Query = N'
				update a
				set '+CASE WHEN @IsPayParameter = 1 then  ' [P6_-5_' else ' [P6_-9_' end  
				+ @ParameterID + '_-8]
				 = case when ' + @SQLCondition + ' then ' + @SQLExpression +
	            ' else ' +CASE WHEN @IsPayParameter  = 1 then '[P6_-5_' else ' [P6_-9_' end + @ParameterID + 
	           N'_-8]   end 
	            	
				from ' + @PCalcTable + ' a
				left join  ' + @GroupAssignmentTable + ' ga on ga.PersonelID = a.PersonelID
				left join  ' + @MissionTable + ' m on m.PersonelID = a.PersonelID
				left join
				(select PersonelID,'+@LeaveTypeCreateColumn+'
				from ' + @LeaveTable + '
				group by PersonelID
				) l on l.PersonelID = a.PersonelID
				left join  ' + @MissionRequestTable + ' mr on mr.PersonelID = a.PersonelID	
				left join  ' + @PersonelRequestTable + 
	            ' pr on pr.PersonelID = a.PersonelID	
				left join #lastAggreement la on la.PersonelID = a.PersonelID	
				left join #absence ab on ab.PersonelID = a.PersonelID	
				'
				--print @Query
        
	        EXEC (@Query)
	        
	        UPDATE #T1
	        SET    Calculated = 1
	        WHERE  FormulaID = @FormulaID
	        
	        UPDATE #All_PayrollParameter
	        SET    Calculated = 1
	        WHERE  FormulaID = @FormulaID
	        
	        FETCH NEXT FROM Calc_Payroll INTO @ParameterID,
	           @SQLCondition,
	           @SQLExpression,
	           @FormulaID,
	           @IsPayParameter
	END 
	
	CLOSE Calc_Payroll 
	DEALLOCATE Calc_Payroll 
	
	INSERT INTO #T1(
	           ParameterID,
	           Calculated,
	           SQLCondition,
	           SQLExpression,
	           FormulaID,
	           IsPayParameter
	       )
	SELECT ParameterID,
	       0,
	       SQLCondition,
	       SQLExpression,
	       FormulaID,
	       IsPayParameter
	FROM   #MonthParameters
	WHERE  FormulaID NOT IN (SELECT FormulaID
	                         FROM   #T1
	                         WHERE  Calculated = 1)
	       AND FormulaID NOT IN (SELECT AttendanceCalculationMethodFormulaID
	                             FROM   atn.AttendanceCalculationMethodFormulaParameter a
	                                    JOIN #All_PayrollParameter b
	                                         ON  b.ParameterID = a.Parameter
	                             WHERE  Category = -5
	                                    AND Calculated = 0)
	GROUP BY
	       ParameterID,
	       SQLCondition,
	       SQLExpression,
	       FormulaID,
	       IsPayParameter
	
	    END
	    
	
	DECLARE Insert_Payroll CURSOR 
	FOR
	    SELECT ISNULL(acm.AttendanceParameterID,acm.ParameterID) ParameterID,
	    CASE WHEN acm.ParameterID is NOT NULL then 1 else 0 END IsPayParameter
	    FROM   atn.AttendanceCalculationMethod acm
	    left join pay.Parameter AS p on p.ParameterID = acm.ParameterID
	    left join atn.AttendanceParameter AS ap on ap.AttendanceParameterID = acm.AttendanceParameterID
	    WHERE  (acm.ParameterID IS NOT NULL or ap.TimingMethod = 2)
	    GROUP BY
	           acm.ParameterID,
	           acm.AttendanceParameterID
	
	OPEN Insert_Payroll 
	FETCH NEXT FROM Insert_Payroll INTO @ParameterID,@IsPayParameter
	
	WHILE @@FETCH_STATUS = 0
	BEGIN
	    SET @Query = 
	        N'
			INSERT INTO [ATN].[PayParameterCalculationResult]
					   ([ParameterID],
					   [AttendanceParameterID]
					   ,[Value]
					   ,[Version]
					   ,[Creator]
					   ,[CreationDate]
					   ,[LastEditor]
					   ,[LastEditionDate]
					   ,[AttendanceCalculationPersonnelID])
			select		' +CASE WHEN @IsPayParameter = 1 then  @ParameterID else 'null' END +N' As ParameterID,' +
			CASE WHEN @IsPayParameter = 0 then  @ParameterID else 'null' End +N' As AttendanceParameterID'+
			CASE WHEN @IsPayParameter = 1 then ',[P6_-5_' 
			else ',[P6_-9_' End + @ParameterID +'_-8]
					   ,[Version]
					   ,[Creator]
					   ,[CreationDate]
					   ,[LastEditor]
					   ,[LastEditionDate]
					   ,[AttendanceCalculationPersonnelID]
			from ' + @PCalcTable + 
	        ' a
			join [ATN].[AttendanceCalculationPersonnel] b
				on a.PersonelID = b.PersonelID and b.[CalendarMonthID] = @CalendarMonthID		
			where '+CASE WHEN @IsPayParameter  = 1 then 'isnull([P6_-5_' else 'isnull([P6_-9_' End + @ParameterID + '_-8],0) <> 0
			'
		    
	    EXECUTE sp_executeSQL 
	            @Query,
	         N'@CreatorID int,
					@CalendarMonthID int',
	         @CreatorID = @CreatorID,
	         @CalendarMonthID = @CalendarMonthID
	    
	    FETCH NEXT FROM Insert_Payroll INTO @ParameterID,@IsPayParameter
	
	END 
	
	CLOSE Insert_Payroll 
	DEALLOCATE Insert_Payroll 
	END


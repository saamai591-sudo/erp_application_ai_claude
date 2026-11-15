
-------------------------------------
CREATE   PROC [ATN].RptPerformanceReport
(
@CalendarMonthID int,
@PersonelIDs  NVARCHAR(MAX)
)

--WITH ENCRYPTION
WITH RECOMPILE
AS
BEGIN
	
	

DECLARE @UserID                    INT,
        @DateType                  VARCHAR(10),
        @DateFormat                VARCHAR(10),
        @Culture                   VARCHAR(10),
	    @StartDate                 DATE,
	    @EndDate                   DATE,
		@OrgselectParamStr         NVARCHAR(MAX),
		@SelectParamStr            NVARCHAR(MAX)
	
SET @Culture = CFG.GetuserCulture();
SET @UserID = cfg.GetuserID();

DECLARE @CultureNo INT;

SELECT @CultureNo = CultureNo
FROM   CFG.CultureInfo
WHERE  Culture = @Culture;

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


DECLARE @PerformanceReportTable varchar(512) = cfg.getTempTableName(1)

exec [ATN].AttendanceCalculate @CalendarMonthID,@PersonelIDs,1,@PerformanceReportTable


select lr.LeaveRequestID,lr.PersonelID,lr.StartDate,lr.EndDate
into #Leave
from atn.LeaveRequest lr 
join atn.RequestType rt on rt.RequestTypeID = lr.RequestTypeID 
where lr.Status = 2 and Timing = 2

select mr.MissionRequestID,mr.PersonelID,mr.StartDate,mr.EndDate
into #Mission
from atn.MissionRequest mr 
left join atn.RequestType rt on rt.RequestTypeID = mr.RequestTypeID
where mr.Status in (2,4) and Timing = 2

select mr.PersonelRequestID,mr.PersonelID,mr.StartDate,mr.EndDate
into #PersonelRequest
from atn.PersonelRequest AS mr 
left join atn.RequestType rt on rt.RequestTypeID = mr.RequestTypeID
where mr.Status in (2,4) and Timing = 2


	SELECT @StartDate = AttendanceStartDate,
	       @EndDate            = AttendanceEndDate
	FROM   hrm.CalendarMonth
	WHERE  CalendarMonthID     = @CalendarMonthID

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
								  ROW_NUMBER() OVER(PARTITION BY cm.AttendanceParameterID ORDER BY cm.Date DESC) AS Rno
						   FROM   ATN.AttendanceCalculationMethod cm
						   join atn.AttendanceParameter AS ap on ap.AttendanceParameterID = cm.AttendanceParameterID
						   where cm.AttendanceParameterID is NOT NULL
						   and ap.TimingMethod = 1
							and date < @StartDate
					   ) T
				WHERE  Rno = 1
				union all 
				SELECT cm.AttendanceCalculationMethodID,
						cm.AttendanceParameterID,
						cm.date
				FROM   ATN.AttendanceCalculationMethod cm
				join atn.AttendanceParameter AS ap on ap.AttendanceParameterID = cm.AttendanceParameterID
				where cm.AttendanceParameterID is NOT NULL
				and ap.TimingMethod = 1
				and date between @StartDate and @EndDate
			),
			cte2 as
			(
			select  ROW_NUMBER() OVER(PARTITION BY AttendanceParameterID ORDER BY Date) AS Rno,
					*
			from cte1
			),
			cte3 as
			(
			select a.AttendanceCalculationMethodID,
				   a.AttendanceParameterID,
				   a.Date SDate,
				   isnull(b.Date,@EndDate) EDate
			from cte2 a
			left join cte2 b on a.AttendanceParameterID = b.AttendanceParameterID and a.rno = b.Rno - 1
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
			   T.EDate,
			   ap.DataEntryMethod
		INTO   #AttendanceParameter
		FROM   cte3 T
		join atn.AttendanceParameter ap on t.AttendanceParameterID = ap.AttendanceParameterID
		LEFT JOIN ATN.AttendanceCalculationMethodFormula f
			ON  f.AttendanceCalculationMethodID = t.AttendanceCalculationMethodID
		LEFT JOIN ATN.AttendanceCalculationMethodFormulaParameter acmfp
			ON  acmfp.AttendanceCalculationMethodFormulaID = f.AttendanceCalculationMethodFormulaID
			AND ParameterValueType = -15
			and ap.TimingMethod = 1
			
		UNION ALL
		SELECT null,ap.AttendanceParameterID,null,null,null,null,null,null,ap.DataEntryMethod FROM atn.AttendanceParameter AS ap
		WHERE 	ap.[Type] = 1 and ap.TimingMethod = 1
			
			
		
		
	set @orgselectParamStr = ' a.PersonelID, a.Date,
								[P5_-6] AS [P5P6], CFG.[ConvertToHourMinute]([P5_-6]) AS [P5P6_time], 
								[P5_-7] AS [P5P7], CFG.[ConvertToHourMinute]([P5_-7]) AS [P5P7_time], 
								[P1_-1] AS [P1P1], CFG.[ConvertToHourMinute]([P1_-1]) AS [P1P1_time],
								[P1_-2] AS [P1P2], CFG.[ConvertToHourMinute]([P1_-2]) AS [P1P2_time],
								[P3_-1] AS [P3P1] , [P5_-14] AS [P5P14] , [P5_-15] AS [P5P15], 
								[P5_-12] AS [P5P12], CFG.[ConvertToHourMinute]([P5_-12]) AS [P5P12_time], 
								[P5_-13] AS [P5P13], CFG.[ConvertToHourMinute]([P5_-13]) AS [P5P13_time], 
								[P5_-18] AS [P5P18], CFG.[ConvertToHourMinute]([P5_-18]) AS [P5P18_time],
								[P5_-19] AS [P5P19], [P5_-19] [P5P19_time]';
	SELECT @selectParamStr = STUFF(
	    (
	        SELECT DISTINCT ',[P6_-6_' + CAST(AttendanceParameterID AS VARCHAR(10)) + '_-8] AS [P6P6P' + CAST(AttendanceParameterID AS VARCHAR(10)) + 'P8]'+case when DataEntryMethod = 2 then '
							 ,CFG.[ConvertToHourMinute]([P6_-6_' + CAST(AttendanceParameterID AS VARCHAR(10)) + '_-8])' else ',[P6_-6_' + CAST(AttendanceParameterID AS VARCHAR(10)) + '_-8]'  end +N'
							 AS [P6P6P' + CAST(AttendanceParameterID AS VARCHAR(10)) + 'P8_time]' 
	        FROM   #AttendanceParameter
			group by AttendanceParameterID,DataEntryMethod
	                FOR XML PATH(''),
	                TYPE
	    ).value('.', 'NVARCHAR(MAX)'),
	    1,
	    1,
	    ''
	)

	
	IF @selectParamStr IS NULL 
		SET @selectParamStr = 'NULL AS [-1]';
		
	declare @notIncludeAttendanceParameters nvarchar(max)

	SELECT @notIncludeAttendanceParameters = STUFF(
        (
            SELECT DISTINCT ', null as [P6P6P' + CAST(AttendanceParameterID AS VARCHAR(10)) + 'P8]
							 , null as [P6P6P' + CAST(AttendanceParameterID AS VARCHAR(10)) + 'P8_time]'
            FROM   ATN.AttendanceParameter
			where AttendanceParameterID not in (
				select DISTINCT AttendanceParameterID from #AttendanceParameter
			)
			and TimingMethod = 1
        FOR XML PATH(''),
        TYPE
        ).value('.', 'NVARCHAR(MAX)'),
        1,
        1,
        ''
    )

	IF @notIncludeAttendanceParameters IS NULL 
	BEGIN
		SET @notIncludeAttendanceParameters = 'NULL AS [-1000]'
	END

	DECLARE @query NVARCHAR(MAX)



	SET @query = N'select  '+@orgselectParamStr+' , '+@selectParamStr+', '+@notIncludeAttendanceParameters+',
			per.Code AS PersonnelCode,
			case when '+CAST(@CultureNo AS VARCHAR(10))+' = 1 then party.Title + '' '' + party.LastName else party.Title2 + '' '' + party.LastName2 end PersonnelTitle,
			case when '+@DateType+' = 0 then dd.PersianFullDateAlternateKey else dd.FullDateAlternateKey end DateString,
			case when '+@DateType+' = 0 then dd.PersianDayOfWeekName else dd.DayOfWeekName end [DayOfWeek],
			case when l.LeaveRequestID is not null then 1 else 0 end IsOnLeave,
			case when m.MissionRequestID is not null then 1 else 0 end IsOnMission,
			a.IsComplete,
			case when pr.PersonelRequestID is not null then 1 else 0 end IsOtherRequestDay			
	from '+@PerformanceReportTable+' a
	join cfg.DimDate DD on a.date = dd.date
	join HRM.Personel per on a.PersonelID = per.PersonelID
	join CFG.Party party on per.PartyID = party.PartyID
	left join #Leave l on l.PersonelID = a.PersonelID and a.date between l.StartDate and l.EndDate
	left join #Mission m on m.PersonelID = a.PersonelID and a.date between m.StartDate and m.EndDate
	left join #PersonelRequest pr on pr.PersonelID = a.PersonelID and a.date between pr.StartDate and pr.EndDate	
	where a.date <= getdate()
	order by dd.Date,[P5_-6]'
	--print @query
EXEC(@query)
END


------------------------------------- START #7997
CREATE   proc ATN.SpGetAllEntryAndExit
(@PersonelID INT, @Date DATE)
as

--DECLARE @PersonelID INT = 6;DECLARE @Date DATE = '2025-01-22';

DECLARE @Culture             NVARCHAR(5),
        @CultureNo           CHAR(1),
        @TableName           NVARCHAR(MAX),
        @CalendarMonthID     INT,
        @Query               NVARCHAR(MAX);

SET @Culture = CFG.GetuserCulture();

SELECT @CalendarMonthID = cm.CalendarMonthID
FROM   hrm.CalendarMonth AS cm
WHERE  @Date
       between cm.StartDate and cm.EndDate
	
SELECT @CultureNo = CultureNo
FROM   CFG.CultureInfo
WHERE  Culture = @Culture;
	
SET @TableName = cfg.getTempTableName (1)
	

	
EXEC atn.AttendanceCalculate
     @CalendarMonthID = @CalendarMonthID,
     @SelectedPersonnelID = @PersonelID,
     @CallFromPerformanceReport = 2,
     @PerformanceReportTable = @TableName,
     @CalcDate = @Date,
     @CalcType = null		
		
CREATE TABLE #OrderedData
(
	RowNum            INT,
	DOCUMENT          NVARCHAR(250),
	SOrEType          NVARCHAR(10),
	PersonelID        INT,
	EffectiveDate     DATE,
	RecordDate        DATE,
	Hour              INT
)
			
SET @Query = 
    N'insert into #OrderedData
	select ROW_NUMBER() OVER (ORDER BY RecordDate,Hour), Document,SOrEType,PersonelID,Date,RecordDate,Hour from ' + 
    @TableName
	
EXEC (@Query)
	
SELECT *
INTO   #vwPersonelStandardEntryAndExit
FROM   atn.vwPersonelStandardEntryAndExit AS vpseae
WHERE  vpseae.PersonelID = @PersonelID
       AND vpseae.StartDate = @Date
	

SELECT CASE 
            WHEN @Culture = 'fa' THEN CASE 
                                           WHEN cur.Document = 'EntryAndExit' THEN N'ورود و خروج'
                                           WHEN cur.Document = 'LeaveRequest' and cur.SOrEType = 'S' THEN N'شروع مرخصی'
                                           WHEN cur.Document = 'LeaveRequest' and cur.SOrEType = 'E' THEN 
                                                N'پایان مرخصی'
                                           WHEN cur.Document = 'MissionRequest' and cur.SOrEType = 'S' THEN 
                                                N'شروع ماموریت'
                                           WHEN cur.Document = 'MissionRequest' and cur.SOrEType = 'E' THEN 
                                                N'پایان ماموریت'
                                           WHEN cur.Document = 'PersonelRequest' and cur.SOrEType = 'S' THEN 
                                                N'شروع سایر درخواستها'
                                           WHEN cur.Document = 'MissionRequest' and cur.SOrEType = 'E' THEN 
                                                N'پایان سایر درخواستها'
                                      END
            ELSE CASE 
                      WHEN cur.Document = 'EntryAndExit' THEN N'Entry And Exit'
                      WHEN cur.Document = 'LeaveRequest' and cur.SOrEType = 'S' THEN N'Start of Leave Request'
                      WHEN cur.Document = 'LeaveRequest' and cur.SOrEType = 'E' THEN N'End of Leave Request'
                      WHEN cur.Document = 'MissionRequest' and cur.SOrEType = 'S' THEN N'Start of Mission Request'
                      WHEN cur.Document = 'MissionRequest' and cur.SOrEType = 'E' THEN N'End of Mission Request'
                      WHEN cur.Document = 'PersonelRequest' and cur.SOrEType = 'S' THEN N'Start of Other Request'
                      WHEN cur.Document = 'MissionRequest' and cur.SOrEType = 'E' THEN N'End of Other Request'
                 END
       END               TypeString,
       cur.PersonelID,
       cur.RecordDate,
       cfg.GetCLRSaturnDate (cur.RecordDate, 'YYYY/mm/dd', 0, 0) Date_Date,
       CFG.ConvertToHourMinute(cur.Hour - DATEDIFF(minute, '1970-01-01', cur.RecordDate)) AS HourMinute,
       cur.Hour - DATEDIFF(minute, '1970-01-01', cur.RecordDate) Hour,
       CASE 
            WHEN prev.Hour IS NOT NULL 
                 AND CAST(prev.RecordDate AS DATE) = CAST(cur.RecordDate AS DATE)
            THEN prev.Hour - DATEDIFF(minute, '1970-01-01', prev.RecordDate)
            WHEN prev.Hour IS NOT NULL 
                 AND CAST(prev.RecordDate AS DATE) < CAST(cur.RecordDate AS DATE)
                 AND vpe.StartHour IS NOT NULL
            THEN vpe.StartHour
            ELSE NULL
        END AS PrevHour,

        CASE 
            WHEN NEXT.Hour IS NOT NULL 
                 AND CAST(NEXT.RecordDate AS DATE) = CAST(cur.RecordDate AS DATE) 
            THEN NEXT.Hour - DATEDIFF(minute, '1970-01-01', NEXT.RecordDate)
            WHEN NEXT.Hour IS NOT NULL 
                 AND CAST(NEXT.RecordDate AS DATE) > CAST(cur.RecordDate AS DATE)
                 AND vpe.EndHour IS NOT NULL
            THEN vpe.EndHour 
            ELSE NULL
        END AS NextHour,
       vpe.StartHour  AS ShiftStartHour,
       vpe.EndHour    AS ShiftEndHour
FROM   #OrderedData   AS cur
       JOIN #vwPersonelStandardEntryAndExit vpe
            ON  cur.PersonelID = vpe.PersonelID
            AND cur.EffectiveDate = vpe.StartDate
       LEFT JOIN #OrderedData prev
            ON  prev.RowNum = cur.RowNum - 1
       LEFT JOIN #OrderedData NEXT
            ON  NEXT.RowNum = cur.RowNum + 1
WHERE  @Date = cur.EffectiveDate
ORDER BY
       RecordDate,
       cur.Hour

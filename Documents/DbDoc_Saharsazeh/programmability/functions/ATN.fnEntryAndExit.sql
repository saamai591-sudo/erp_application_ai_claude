------------------------------------- START #7656
CREATE   FUNCTION atn.fnEntryAndExit
(
	@StartDate      DATE,
	@EndDate        DATE,
	@PersonelID     INT
)
RETURNS Table
AS

RETURN

SELECT DATEDIFF(minute, '1970-01-01', DATE) + Hour RecordTime,
		DATEDIFF(minute, '1970-01-01', DATE) + Hour RecordEndTime,
       eae.[Date],
       eae.PersonelID,
       eae.EntryAndExitID as DocumentID,
       'EntryAndExit' as Document
FROM   atn.EntryAndExit AS eae
WHERE  eae.[Date] between @StartDate and @EndDate
       AND (@PersonelID is NULL OR eae.PersonelID = @PersonelID)

--------Start of LeaveRequest
UNION ALL
SELECT CASE rt.Timing
            WHEN 2 THEN vas.ShiftStartingHour
            ELSE DATEDIFF(minute, '1970-01-01', mr.StartDate) + mr.StartHour
       END,
       CASE rt.Timing
            WHEN 2 THEN vas.ShiftEndingHour
            ELSE DATEDIFF(minute, '1970-01-01', mr.EndDate) + mr.EndHour
       END,
       vas.StartDate,
       mr.PersonelID,
       mr.LeaveRequestID As DocumentID,
       'LeaveRequest' as Document
FROM   atn.LeaveRequest                AS mr
       JOIN atn.RequestType            AS rt
            ON  rt.RequestTypeID = mr.RequestTypeID
       JOIN atn.vwPersonelShiftInDate  AS vpsid
            ON  vpsid.[Date] 
                between mr.StartDate and mr.EndDate
            AND mr.PersonelID = vpsid.PersonelID
       JOIN atn.vwAttendanceShift      AS vas
            ON  vpsid.[Date] = vas.StartDate
            AND vpsid.AttendanceShiftID = vas.AttendanceShiftID
WHERE   mr.[Status] <> 3
       AND vpsid.[Date] between @StartDate and @EndDate
       AND (@PersonelID is NULL OR mr.PersonelID = @PersonelID)
----------End of LeaveRequest

UNION ALL

----    Start of Mission Request
 SELECT CASE rt.Timing
            WHEN 2 THEN vas.ShiftStartingHour
            ELSE DATEDIFF(minute, '1970-01-01', mr.StartDate) + mr.StartHour
       END,
       CASE rt.Timing
            WHEN 2 THEN vas.ShiftEndingHour
            ELSE DATEDIFF(minute, '1970-01-01', mr.EndDate) + mr.EndHour
       END,
       vas.StartDate,
       mr.PersonelID,
       mr.MissionRequestID As DocumentID,
       'MissionRequest' as DOCUMENT
       FROM   atn.MissionRequest              AS mr
       JOIN atn.RequestType            AS rt
            ON  rt.RequestTypeID = mr.RequestTypeID
       JOIN atn.vwPersonelShiftInDate  AS vpsid
            ON  vpsid.[Date] 
                between mr.StartDate and mr.EndDate
            AND mr.PersonelID = vpsid.PersonelID
       JOIN atn.vwAttendanceShift      AS vas
            ON  vpsid.[Date] = vas.StartDate
            AND vpsid.AttendanceShiftID = vas.AttendanceShiftID
WHERE   mr.[Status] <> 3
       AND vpsid.[Date] between @StartDate and @EndDate
       AND (@PersonelID is NULL OR mr.PersonelID = @PersonelID)
----    End of Mission Request

UNION ALL

----    Start of Personel Request
SELECT CASE rt.Timing
            WHEN 2 THEN vas.ShiftStartingHour
            ELSE DATEDIFF(minute, '1970-01-01', mr.StartDate) + mr.StartHour
       END,
       CASE rt.Timing
            WHEN 2 THEN vas.ShiftEndingHour
            ELSE DATEDIFF(minute, '1970-01-01', mr.EndDate) + mr.EndHour
       END,
       vas.StartDate,
       mr.PersonelID,
       mr.PersonelRequestID As DocumentID,
       'PersonelRequest' as Document
FROM   atn.PersonelRequest             AS mr
       JOIN atn.RequestType            AS rt
            ON  rt.RequestTypeID = mr.RequestTypeID
       JOIN atn.vwPersonelShiftInDate  AS vpsid
            ON  vpsid.[Date] 
                between mr.StartDate and mr.EndDate
            AND mr.PersonelID = vpsid.PersonelID
       JOIN atn.vwAttendanceShift      AS vas
            ON  vpsid.[Date] = vas.StartDate
            AND vpsid.AttendanceShiftID = vas.AttendanceShiftID
WHERE   mr.[Status] <> 3
       AND vpsid.[Date] between @StartDate and @EndDate
       AND (@PersonelID is NULL OR mr.PersonelID = @PersonelID)
----    End of Personel Request

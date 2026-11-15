---------------------------------------------------------------------------------------------------------
CREATE   PROC [ATN].RptPerformanceReviewReport_Personnel
(@CalendarMonthID INT)
AS
BEGIN
    DECLARE @SelectedMonth_AttendanceEndDate DATE,
            @CultureNo INT;

    SELECT @CultureNo = CultureNo
    FROM CFG.CultureInfo
    WHERE Culture = CFG.GetuserCulture();

    SELECT @SelectedMonth_AttendanceEndDate = AttendanceEndDate
    FROM HRM.CalendarMonth
    WHERE CalendarMonthID = @CalendarMonthID;


    SELECT PersonelID,
           PersonnelCode,
           PersonnelTitle,
           ShiftTitle,
           EmploymentTypeTitle,
           WorkPlaceTitle,
           CostCenterTitle
    FROM
    (
        SELECT psai.PersonelID,
               per.Code AS PersonnelCode,
               CASE @CultureNo
                   WHEN 1 THEN
                       party.Title + ' ' + party.LastName
                   ELSE
                       party.Title2 + ' ' + party.LastName2
               END AS PersonnelTitle,
               psai.DATE,
               CASE @CultureNo
                   WHEN 1 THEN
                       ats.Title
                   ELSE
                       ats.Title2
               END AS ShiftTitle,
               CASE @CultureNo
                   WHEN 1 THEN
                       et.Title
                   ELSE
                       et.Title2
               END AS EmploymentTypeTitle,
               CASE @CultureNo
                   WHEN 1 THEN
                       wp.Title
                   ELSE
                       wp.Title2
               END AS WorkPlaceTitle,
               CASE @CultureNo
                   WHEN 1 THEN
                       cs.Title
                   ELSE
                       cs.Title2
               END AS CostCenterTitle,
               ROW_NUMBER() OVER (PARTITION BY psai.PersonelID ORDER BY psai.DATE DESC) AS rowNumber
        FROM ATN.PersonnelShiftAssignmentItem AS psai
            JOIN ATN.AttendanceShift AS ats
                ON psai.AttendanceShiftID = ats.AttendanceShiftID
            JOIN
            (
                SELECT *
                FROM
                (
                    SELECT *,
                           ROW_NUMBER() OVER (PARTITION BY a.PersonelID ORDER BY a.ExecuteDate DESC) AS rn
                    FROM HRM.Agreement AS a
                    WHERE a.ExecuteDate <=@SelectedMonth_AttendanceEndDate
                ) t
                WHERE t.rn = 1
                     
            ) ag
                ON psai.PersonelID = ag.PersonelID
            JOIN HRM.EmploymentType AS et
                ON ag.EmploymentTypeID = et.EmploymentTypeID
            JOIN HRM.WorkPlace AS wp
                ON ag.WorkPlaceID = wp.WorkPlaceID
            JOIN HRM.AgreementType AS agt
                ON ag.AgreementTypeID = agt.AgreementTypeID
            JOIN CFG.CostCenter AS cs
                ON ag.CostCenterID = cs.CostCenterID
            JOIN hrm.fnGetActivePersonelInMonth(@CalendarMonthID,2)  AS per
                ON psai.PersonelID = per.PersonelID
            JOIN CFG.Party AS party
                ON per.PartyID = party.PartyID
        WHERE psai.[Date] <= @SelectedMonth_AttendanceEndDate
    ) AS temp
    WHERE temp.rowNumber = 1;
END;

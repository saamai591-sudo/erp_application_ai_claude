CREATE PROC [ATN].RptPerformanceReviewReport_Performance
(
    @CalendarMonthID INT,
    @PersonnelIDs NVARCHAR(MAX) = NULL
)
AS
BEGIN
    IF (@PersonnelIDs IS NULL)
    BEGIN
        DROP TABLE IF EXISTS #tempPersonnels

        CREATE TABLE #tempPersonnels
        (
            PersonelID INT,
            PersonnelCode NVARCHAR(MAX),
            PersonnelTitle NVARCHAR(MAX),
            ShiftTitle NVARCHAR(MAX),
            EmploymentTypeTitle NVARCHAR(MAX),
            WorkPlaceTitle NVARCHAR(MAX),
            CostCenterTitle NVARCHAR(MAX),
        )

        INSERT INTO #tempPersonnels
        EXEC [ATN].RptPerformanceReviewReport_Personnel @CalendarMonthID

        SELECT @PersonnelIDs = STRING_AGG(PersonelID, ',')
        FROM #tempPersonnels

    END

    EXEC [ATN].RptPerformanceReport @CalendarMonthID, @PersonnelIDs
END;

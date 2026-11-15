
-- #63066 / #66259 Staging port of develop 000357.sql as v2 (do not add legacy 000357 on staging).
-- Rebuild payroll month helpers from DimDate, then drop unused CFG.ShamsiToGregorian.

CREATE   FUNCTION [PAY].[GetStartDateOfMonth](@year INT, @month INT)
RETURNS DATE
AS
BEGIN
	RETURN (
		SELECT MIN([Date])
		FROM CFG.DimDate
		WHERE PersianCalendarYear = @year
		  AND PersianMonthNumberOfYear = @month
	);
END

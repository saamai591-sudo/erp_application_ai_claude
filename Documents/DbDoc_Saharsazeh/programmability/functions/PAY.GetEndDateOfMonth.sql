
CREATE   FUNCTION [PAY].[GetEndDateOfMonth](@year INT, @month INT)
RETURNS DATE
AS
BEGIN
	RETURN (
		SELECT MAX([Date])
		FROM CFG.DimDate
		WHERE PersianCalendarYear = @year
		  AND PersianMonthNumberOfYear = @month
	);
END

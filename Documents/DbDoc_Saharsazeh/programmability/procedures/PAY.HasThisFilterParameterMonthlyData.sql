/************************************************************
 * Code formatted by SoftTree SQL Assistant © v9.5.444
 * Time: 3/17/2019 2:46:00 PM
 ************************************************************/

CREATE PROCEDURE [PAY].[HasThisFilterParameterMonthlyData](@CalendarMonthID INT, @MontlyDataFilterId INT)
AS
	SELECT TOP 1 1 
	FROM   Pay.ParameterMonthlyDataFilter AS pmdf
	       INNER JOIN PAY.ParameterMonthlyDataFilterParameter AS pmdfp
	            ON  pmdfp.ParameterMonthlyDataFilterID = pmdf.ParameterMonthlyDataFilterID
	       INNER JOIN Pay.ParameterMonthlyData AS pmd
	            ON  pmdfp.ParameterID = pmd.ParameterID
	WHERE  pmdfp.ParameterMonthlyDataFilterID = @MontlyDataFilterId
	       AND CalendarMonthID = @CalendarMonthID
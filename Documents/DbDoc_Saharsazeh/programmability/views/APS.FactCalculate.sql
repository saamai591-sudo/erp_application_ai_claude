CREATE   VIEW [APS].[FactCalculate]
AS 


SELECT 
cast(cp.CalendarMonthID AS bigint)*1000000000+cast(PersonelID AS BIGINT) AS Id,
cp.CalculationTypeID,
       cp.CalendarMonthID,
       cp.PersonelID,
       cr.ParameterID,
       cr.ParameterValueTypeID,
       cr.[Value]
FROM   pay.CalculationResult  AS cr
            JOIN pay.CalculationPersonel AS cp ON cp.CalculationPersonelID = cr.CalculationPersonelID

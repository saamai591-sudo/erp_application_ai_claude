CREATE FUNCTION [CFG].[GetBaseCurrencyPrecision]()
RETURNS INT
BEGIN
DECLARE @BaseCurrencyPrecision INT;

SET @BaseCurrencyPrecision = (SELECT PrecisionCount FROM cfg.currency WHERE CurrencyID = -1)
RETURN @BaseCurrencyPrecision
END

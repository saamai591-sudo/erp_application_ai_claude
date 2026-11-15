/************************************************************
 * Code formatted by SoftTree SQL Assistant © v9.5.444
 * Time: 10/3/2019 9:32:04 AM
 ************************************************************/

CREATE   PROCEDURE [CFG].[GetSanaScheduleData]
AS
	IF (
	       SELECT configValue
	       FROM   cfg.Configuration AS c
	       WHERE  c.ConfigKey = 'GetCurrencyRateFromSana'
	   ) = 'true'
	BEGIN
	    SELECT configValue
	    FROM   cfg.Configuration AS c
	    WHERE  c.ConfigKey = 'SanaExecTime'
		RETURN 
	END
	
	SELECT NULL

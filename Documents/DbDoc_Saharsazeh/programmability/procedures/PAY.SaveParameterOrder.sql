
/************************************************************
 * Code formatted by SoftTree SQL Assistant © v7.2.338
 * Time: 9/6/2015 12:43:41 AM
 ************************************************************/

CREATE PROCEDURE [PAY].[SaveParameterOrder](@orderType TINYINT, @data VARCHAR(MAX))
AS
	DELETE pay.ParameterOrder
	WHERE  OrderType = @orderType
	
	
	DECLARE @userId INT
	
	SET @userId = cfg.GetuserID()
	
	INSERT INTO pay.ParameterOrder
	  (
	    -- ParameterOrderID -- this column value is auto-generated
	    ParameterID,
	    OrderType,
	    OrderIndex,
	    Creator,
	    CreationDate,
	    LastEditor,
	    LastEditionDate,
	    Version
	  )
	SELECT cfg.GetStringPartBySpliter(VALUE, 1, '#'),
	       @orderType,
	       cfg.GetStringPartBySpliter(VALUE, 2, '#'),
	       @userId,
	       GETDATE(),
	       @userId,
	       GETDATE(),
	       1
	FROM   cfg.R_FnCommaStr2Table(@data) AS rfcst
	

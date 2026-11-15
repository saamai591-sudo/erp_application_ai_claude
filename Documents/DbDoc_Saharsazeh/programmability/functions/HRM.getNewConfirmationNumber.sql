/************************************************************
 * Code formatted by SoftTree SQL Assistant © v7.2.338
 * Time: 08/02/2015 09:09:07 ق.ظ
 ************************************************************/

CREATE FUNCTION [HRM].[getNewConfirmationNumber]
(
	@confirmationTypeId INT
)
RETURNS INT

BEGIN
	RETURN ISNULL(
	    (
	        SELECT MAX(a.Number) + 1
	        FROM   hrm.Confirmation a
	        WHERE  a.ConfirmationTypeID = @COnfirmationTypeId
	    ),
	    (
	        SELECT TOP 1 ct.FromNumber
	        FROM   hrm.ConfirmationType ct
	        WHERE  ct.ConfirmationTypeID = @confirmationTypeId
	    )
	)
END


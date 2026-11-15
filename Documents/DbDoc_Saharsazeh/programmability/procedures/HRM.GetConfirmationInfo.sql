
/************************************************************
 * Code formatted by SoftTree SQL Assistant © v6.3.153
 * Time: 07/23/2015 01:15:43 ب.ظ
 ************************************************************/

CREATE PROCEDURE [HRM].[GetConfirmationInfo](
    @PersonelId             INT,
    @ConfirmationTypeId     INT,
    @IssueDate              DATE,
    @ConfirmationID         INT = NULL
)
--with encryption
AS
	CREATE TABLE #value
	(
		val DECIMAL
	)
	
	
	INSERT INTO #value
	EXEC Hrm.CalcConfirmationCeil @PErsonelId,
	     @ConfirmationTypeId,
	     @IssueDate
	
	
	DECLARE @ConfirmationFormID INT
	
	SELECT @ConfirmationFormID = ct.ConfirmationFormID
	FROM   hrm.ConfirmationType ct
	WHERE  ct.ConfirmationTypeID = @ConfirmationTypeId
	
	
	
	INSERT INTO #value
	SELECT SUM(c.InstallmentAmount)
	FROM   hrm.Confirmation c
	       INNER JOIN HRM.ConfirmationType ct
	            ON  ct.ConfirmationTypeID = c.ConfirmationTypeID
	WHERE  ct.ConfirmationFormID = @ConfirmationFormID
	       AND c.PersonelID = @PersonelId
	       AND (
	               @ConfirmationID IS NULL
	               OR c.ConfirmationID <> @ConfirmationID
	           )
	       AND CloseDate IS NULL
	       AND c.IssueDate<=@IssueDate
	
	
	SELECT *
	FROM   #value


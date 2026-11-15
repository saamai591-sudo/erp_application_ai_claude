
CREATE   PROC ATN.spPersonnelShiftAssignmentItemDelete 
    @PersonnelShiftAssignmentItemID int,
	@Version int
AS 
	SET NOCOUNT ON 
	SET XACT_ABORT ON  
	
IF @Version =
(
    SELECT [Version]
    FROM ATN.PersonnelShiftAssignmentItem
    WHERE PersonnelShiftAssignmentItemID = @PersonnelShiftAssignmentItemID
)
BEGIN
	DELETE
	FROM   ATN.PersonnelShiftAssignmentItem
	WHERE  PersonnelShiftAssignmentItemID = @PersonnelShiftAssignmentItemID

END;
ELSE
BEGIN

    RAISERROR(   N'Delete_%s_%d.',      -- Message text.
                 16,                    -- Severity,
                 10,                    -- State,
                 N'PersonnelShiftAssignmentItem', -- First argument.
                 @PersonnelShiftAssignmentItemID
             ); -- Second argument.

END;




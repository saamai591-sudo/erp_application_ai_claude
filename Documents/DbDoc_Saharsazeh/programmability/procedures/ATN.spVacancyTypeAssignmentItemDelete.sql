
---------------------------------------------------------
CREATE   PROC ATN.spVacancyTypeAssignmentItemDelete 
    @VacancyTypeAssignmentItemID INT,
	@Version INT
AS 
	SET NOCOUNT ON 
	SET XACT_ABORT ON  
	
IF @Version =
(
    SELECT [Version]
    FROM ATN.VacancyTypeAssignmentItem
    WHERE VacancyTypeAssignmentItemID = @VacancyTypeAssignmentItemID
)
    BEGIN
	    DELETE 
        FROM ATN.VacancyTypeAssignmentItem
	    WHERE VacancyTypeAssignmentItemID = @VacancyTypeAssignmentItemID
    END
ELSE
    BEGIN
        RAISERROR(   N'Delete_%s_%d.',      -- Message text.
                     16,                    -- Severity,
                     10,                    -- State,
                     N'VacancyTypeAssignmentItem', -- First argument.
                     @VacancyTypeAssignmentItemID
                 ); -- Second argument.
    END

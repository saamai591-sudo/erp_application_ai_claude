
CREATE    PROC [CNT].[SpContractStatementDelete] 
    @ContractStatementID int,@Version int
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 
	
	IF [CNT].[ContractStatementHasFlow](@ContractStatementID) = 1
	BEGIN
		RAISERROR('Contract.ContractStatementInFlow', 16, 10);
		RETURN;
	END;
	
	IF @Version=(SELECT [Version] FROM [CNT].[ContractStatement]
	WHERE [ContractStatementID] = @ContractStatementID)
	BEGIN	
		DELETE
		FROM   [CNT].[ContractStatement]
		WHERE  [ContractStatementID] = @ContractStatementID
	END
	ELSE
	BEGIN
	
	RAISERROR (N'Delete_%s_%d.', -- Message text.
		16, -- Severity,
		10, -- State,
		N'ContractStatement', -- First argument.
		@ContractStatementID); -- Second argument.)
	END;

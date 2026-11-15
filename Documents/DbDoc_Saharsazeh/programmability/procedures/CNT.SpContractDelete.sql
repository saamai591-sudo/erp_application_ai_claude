CREATE   PROC [CNT].[SpContractDelete]
	@ContractID INT ,
	@Version INT
--WITH ENCRYPTION
AS
	SET NOCOUNT ON 

	IF @Version = ( SELECT  [Version]
					FROM    [CNT].[Contract]
					WHERE   [ContractID] = @ContractID
				  )
	BEGIN	
		DECLARE @DLId INT,
		@IscontractComplement bit,
		@Status int

		SELECT  @DLId = [DLID],
				@Status = Status,
				@IscontractComplement = CASE 
											WHEN ParentID IS NULL THEN 0 
											ELSE 1
										 END
		FROM    [CNT].[Contract]
		WHERE   [ContractID] = @ContractID

		IF @Status = 2
		BEGIN
			RAISERROR('امکان حذف قرارداد تایید شده وجود ندارد', 16, 12);
			RETURN 
		END;
		
		DECLARE @HasFlow BIT = (SELECT CNT.ContractHasFlow(@ContractID) )
		IF (@HasFlow = 1)
		BEGIN
			RAISERROR('HasFlowItemCanNotEdit', 16, 12);
			RETURN;
		END;

		DELETE  FROM [CNT].[Contract]
		WHERE   [ContractID] = @ContractID
		
		if (@IscontractComplement = 0)-- @IscontractComplement == false
		begin
				DELETE  FROM [ACC].[DL]
				WHERE   [DLID] = @DLId
		end
	END
	ELSE
	BEGIN
	
		RAISERROR (N'Delete_%s_%d.', -- Message text.
			16, -- Severity,
			10, -- State,
			N'Contract', -- First argument.
			@ContractID); -- Second argument.)
	END;

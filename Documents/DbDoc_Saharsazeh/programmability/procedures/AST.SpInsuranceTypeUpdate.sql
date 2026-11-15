CREATE PROC [AST].[SpInsuranceTypeUpdate] 
    @InsuranceTypeID int,
    @Title nvarchar(250),
    @Title2 nvarchar(250),
	@InsuranceCost int = null,
	@PrepaidInsurance int = null,
    @Version int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime
--WITH ENCRYPTION
AS 

	SET NOCOUNT ON 

	if @Version <> (Select [Version] from [AST].[InsuranceType]
				where [InsuranceTypeID] = @InsuranceTypeID)
	RAISERROR('Version mismatch...', 16 , 10)


	set @Version = @Version +1 

		UPDATE [AST].[InsuranceType]
		SET    [Title] = @Title, [Title2] = @Title2, [InsuranceCost] = @InsuranceCost, [PrepaidInsurance] = @PrepaidInsurance, [Version] = @Version, [Creator] = @Creator, [CreationDate] = @CreationDate, [LastEditor] = @LastEditor, [LastEditionDate] = @LastEditionDate
		WHERE  [InsuranceTypeID] = @InsuranceTypeID
	
		-- Begin Return Select <- do not remove
		SELECT [Version]
		FROM   [AST].[InsuranceType]
		WHERE  [InsuranceTypeID] = @InsuranceTypeID	
		-- End Return Select <- do not remove

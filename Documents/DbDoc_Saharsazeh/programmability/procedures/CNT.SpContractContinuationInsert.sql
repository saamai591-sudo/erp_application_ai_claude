CREATE PROC [CNT].[SpContractContinuationInsert]
    @ContractID INT ,
    @Date DATE ,
    @Life SMALLINT ,
    @EndDate DATE ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME
--WITH ENCRYPTION
AS
    SET NOCOUNT ON 
	
    DECLARE @LastEndDate DATE ,
        @LastDate DATE ,
        @Message NVARCHAR(MAX)

    SELECT  @LastDate = [Date] ,
            @LastEndDate = EndDate
    FROM    CNT.ContractContinuation
    WHERE   ContractID = @ContractID

    IF @LastDate IS NULL
        AND @LastEndDate IS NULL
        BEGIN 
            SELECT  @LastDate = [Date] ,
                    @LastEndDate = EndDate
            FROM    CNT.Contract
            WHERE   ContractID = @ContractID
        END 

    IF @Date < @LastDate
        BEGIN
            SELECT  @Message = 'CNT_ContinutionDateBiggerThanLastContinutionDate'
            RAISERROR(@Message,16,12)
            RETURN
        END
    
    IF @LastEndDate > @EndDate
        BEGIN
            SELECT  @Message = 'CNT_EndDateBiggerThanLastEndDate'
            RAISERROR(@Message,16,12)
            RETURN
        END
	
    INSERT  INTO [CNT].[ContractContinuation]
    ( [ContractID] ,
        [Date] ,
        [Life] ,
        [EndDate] ,
        [Creator] ,
        [CreationDate] ,
        [LastEditor] ,
        [LastEditionDate] ,
        [Version]
    )
    SELECT  @ContractID ,
            @Date ,
            @Life ,
            @EndDate ,
            @Creator ,
            @CreationDate ,
            @LastEditor ,
            @LastEditionDate ,
            0
	
	-- Begin Return Select <- do not remove
    SELECT  [ContractContinuationID] ,
            [Version]
    FROM    [CNT].[ContractContinuation]
    WHERE   [ContractContinuationID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove

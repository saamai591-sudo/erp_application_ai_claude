CREATE PROC [CNT].[SpContractContinuationUpdate]
    @ContractContinuationID INT ,
    @ContractID INT ,
    @Date DATE ,
    @Life SMALLINT ,
    @EndDate DATE ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME ,
    @Version INT
--WITH ENCRYPTION
AS
    SET NOCOUNT ON 

    IF @Version <> ( SELECT [Version]
                     FROM   [CNT].[ContractContinuation]
                     WHERE  [ContractContinuationID] = @ContractContinuationID
                   )
        BEGIN
            RAISERROR('Version mismatch...', 16 , 10)
            RETURN
        END

    DECLARE @LastEndDate DATE ,
        @LastDate DATE ,
        @Message NVARCHAR(MAX)

    SELECT  @LastDate = [Date] ,
            @LastEndDate = EndDate
    FROM    CNT.ContractContinuation
    WHERE   ContractID = @ContractID
            AND ContractContinuationID <> @ContractContinuationID

    IF @LastDate IS NULL
        AND @LastEndDate IS NULL
        BEGIN 
            SELECT  @LastDate = [Date] ,
                    @LastEndDate = EndDate
            FROM    CNT.[Contract]
            WHERE   ContractID = @ContractID
        END 

    IF @Date < @LastDate
        BEGIN
            SELECT  @Message =  'CNT_ContinutionDateBiggerThanLastContinutionDate'
            RAISERROR(@Message,16,12)
            RETURN
        END
    
    IF @LastEndDate > @EndDate
        BEGIN
            SELECT  @Message = 'CNT_EndDateBiggerThanLastEndDate'
            RAISERROR(@Message,16,12)
            RETURN
        END

    SET @Version = @Version + 1 

    UPDATE  [CNT].[ContractContinuation]
    SET     [ContractID] = @ContractID ,
            [Date] = @Date ,
            [Life] = @Life ,
            [EndDate] = @EndDate ,
            [Creator] = @Creator ,
            [CreationDate] = @CreationDate ,
            [LastEditor] = @LastEditor ,
            [LastEditionDate] = @LastEditionDate ,
            [Version] = @Version
    WHERE   [ContractContinuationID] = @ContractContinuationID
	
	-- Begin Return Select <- do not remove
    SELECT  [Version]
    FROM    [CNT].[ContractContinuation]
    WHERE   [ContractContinuationID] = @ContractContinuationID	
	-- End Return Select <- do not remove

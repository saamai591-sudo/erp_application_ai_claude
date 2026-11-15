CREATE PROC [POS].[spInstallmentAccumulationUpdate] 
    @InstallmentAccumulationID INT,
    @Number INT,
    @Date DATE,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @Version INT,
    @FinancialPeriodID INT
AS 
	SET NOCOUNT ON 
    IF @Number IS NULL
        OR @Number = 0
        SET @Number = ISNULL(( SELECT   MAX(Number) + 1
                               FROM     POS.InstallmentAccumulation
                               WHERE    FinancialPeriodID = @FinancialPeriodID
                             ), 0);

	IF @Version=(SELECT [Version] FROM [POS].[InstallmentAccumulation]
	WHERE [InstallmentAccumulationID] = @InstallmentAccumulationID)
	BEGIN	
		SET @Version = @Version +1 

		UPDATE [POS].[InstallmentAccumulation]
		SET    [Number] = @Number, [Date] = @Date, [Creator] = @Creator, [CreationDate] = @CreationDate, [LastEditor] = @LastEditor, [LastEditionDate] = @LastEditionDate, [Version] = @Version, [FinancialPeriodID] = @FinancialPeriodID
		WHERE  [InstallmentAccumulationID] = @InstallmentAccumulationID
	
		-- Begin Return Select <- do not remove
		SELECT [Version],
                [Number]
        FROM   [POS].[InstallmentAccumulation]
		WHERE  [InstallmentAccumulationID] = @InstallmentAccumulationID	
		-- End Return Select <- do not remove
    END

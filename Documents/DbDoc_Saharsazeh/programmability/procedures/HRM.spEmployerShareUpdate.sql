CREATE   PROC [HRM].[spEmployerShareUpdate]
    @EmployerShareID SMALLINT,
    @Date DATE,
    @Level TINYINT,
    @Type TINYINT,
    @FoodTypeID INT,
    @Amount DECIMAL(30, 10),
    @Version INT,
    @Creator INT,
    @CreationDate DATE,
    @LastEditor INT,
    @LastEditionDate DATE
--WITH ENCRYPTION
AS
    SET NOCOUNT ON;

	IF EXISTS(SELECT 1 FROM hrm.FoodOrder AS fo WHERE fo.Date> @Date)
	BEGIN
	    RAISERROR(N'WelfareManagement.Messages.FoodOrderExists', 16, 12);
        RETURN;
	END

    IF @Version <>
    (
        SELECT [Version]
        FROM HRM.EmployerShare
        WHERE [EmployerShareID] = @EmployerShareID
    )
        RAISERROR('Version mismatch...', 16, 10);

    UPDATE HRM.EmployerShare
    SET [Date] = @Date,
        [Level] = @Level,
        [Type] = @Type,
        [Amount] = @Amount,
        [FoodTypeID] = @FoodTypeID,
        [Version] = @Version,
        [Creator] = @Creator,
        [CreationDate] = @CreationDate,
        [LastEditor] = @LastEditor,
        [LastEditionDate] = @LastEditionDate
    WHERE [EmployerShareID] = @EmployerShareID;

    -- Begin Return Select <- do not remove
    SELECT [Version]
    FROM HRM.EmployerShare
    WHERE [EmployerShareID] = @EmployerShareID;
    -- End Return Select <- do not remove


/************************************************************
 * Code formatted by SoftTree SQL Assistant © v6.3.153
 * Time: 06/07/2015 02:13:15 ب.ظ
 ************************************************************/

CREATE PROCEDURE [PAY].[CreateCopyOfPayrollFile](@payrollFile INT) 
--With Encryption
AS
	DECLARE @newId      INT,
	        @userId     INT
	
	SET @userId = Cfg.GetuserID()
	
	
	
	INSERT INTO Pay.PayrollFile
	  (
	    -- PayrollFileID -- this column value is auto-generated
	    IsOrgan,
	    Title,
	    Title2,
	    OrganizationID,
	    BankID,
	    Seprator,
	    [FileName],
	    FileItemName,
	    FileType,
	    FileExt,
	    HasSeprateItem,
	    FileHasHeader,
	    PaymentTopicID,
	    Creator,
	    CreationDate,
	    LastEditor,
	    LastEditionDate,
	    Version
	  )
	SELECT pf.IsOrgan,
	       ' کپي ' + pf.Title,
	       ' کپي ' + pf.Title2,
	       pf.OrganizationID,
	       pf.BankID,
	       pf.Seprator,
	       pf.[FileName],
	       pf.FileItemName,
	       pf.FileType,
	       pf.FileExt,
	       pf.HasSeprateItem,
	       pf.FileHasHeader,
	       pf.PaymentTopicID,
	       @userId,
	       GETDATE(),
	       @userId,
	       GETDATE(),
	       1
	FROM   pay.PayrollFile pf
	WHERE  pf.PayrollFileID = @payrollFile
	
	SET @newId = SCOPE_IDENTITY()
	
	INSERT INTO Pay.PayrollFileItem
	  (
	    -- PayrollFileItemID -- this column value is auto-generated
	    PayrollFileID,
	    Title,
	    Title2,
	    EngName,
	    ItemType,
	    ItemValueType,
	    ItemValue,
		DisplayTarget,
	    ItemLength,
	    AggFunc,
	    PaddingChar,
	    ItemOrder,
	    ItemRealType,
	    ItemDataSourceType,
	    Creator,
	    CreationDate,
	    LastEditor,
	    LastEditionDate,
	    Version
	  )
	SELECT @newId,
	       pfi.Title,
	       pfi.Title2,
	       pfi.EngName,
	       pfi.ItemType,
	       pfi.ItemValueType,
	       pfi.ItemValue,
	       pfi.DisplayTarget,
	       pfi.ItemLength,
	       pfi.AggFunc,
	       pfi.PaddingChar,
	       pfi.ItemOrder,
	       pfi.ItemRealType,
	       pfi.ItemDataSourceType,
	       @userId,
	       GETDATE(),
	       @UserId,
	       GETDATE(),
	       1
	FROM   pay.PayrollFileItem pfi
	WHERE  pfi.PayrollFileID = @payrollFile

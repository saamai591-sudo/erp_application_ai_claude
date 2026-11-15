
CREATE     PROC [RUL].[UserDefinedDeleteBusinessRules_Voucher]
(@EntityIDs NVARCHAR(MAX))
AS 

 SELECT VALUE as VoucherID
   INTO   #DeletedVouchers
   FROM   CFG.R_FnCommaStr2Table('1,2,3');

   DECLARE @UserID INT,@UserName NVARCHAR(250),@DeleteDate DATETIME
   
   set @UserID = cfg.GetuserID()
   SELECT @UserName = u.UserID FROM cfg.[User] AS u WHERE u.UserID = @UserID
  set @DeleteDate = (SELECT GETDATE() )
   
 

INSERT INTO cfg.DeleteVoucherLog
(
	VoucherID,
	UserID,
	UserName,
	DeleteDate
)
SELECT VoucherID,@UserID,@UserName,@DeleteDate FROM #DeletedVouchers